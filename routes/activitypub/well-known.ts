import { Application, Request, Response } from 'express'
import { Post, User, sequelize } from '../../db'
import { environment } from '../../environment'
import { return404 } from '../../utils/return404'
import { Op } from 'sequelize'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const routeCache = require('route-cache')
let lastTimeCached: Date = new Date(0)
let activeUsersMonthCached: number
let activeUsersHalfYearCached: number

function wellKnownRoutes(app: Application) {
  // webfinger protocol
  app.get('/.well-known/host-meta', (req: Request, res) => {
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?><XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"><Link rel="lrdd" template="${environment.frontendUrl}/.well-known/webfinger?resource={uri}"/></XRD>`
    )
    res.end()
  })
  app.get('/.well-known/webfinger/', routeCache.cacheSeconds(15), async (req: Request, res: Response) => {
    if (req.query?.resource) {
      const urlQueryResource: string = req.query.resource as string
      if (urlQueryResource.startsWith('acct:') && urlQueryResource.endsWith(environment.instanceUrl)) {
        const userUrl = urlQueryResource.slice(5).slice(0, -(environment.instanceUrl.length + 1))
        const user = await User.findOne({
          where: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', userUrl.toLowerCase())
        })
        if (!user) {
          return404(res)
          return
        }
        const response = {
          subject: urlQueryResource,
          aliases: [
            `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`,
            `${environment.frontendUrl}/blog/${user.url.toLowerCase()}`
          ],
          links: [
            {
              rel: 'self',
              type: 'application/activity+json',
              href: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`
            },
            {
              rel: 'http://ostatus.org/schema/1.0/subscribe',
              template: `${environment.frontendUrl}/fediverse/authorize_interaction?uri={uri}`
            }
          ]
        }
        res.send(response)
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
    res.end()
  })

  app.get('/.well-known/nodeinfo', routeCache.cacheSeconds(300), (req, res) => {
    res.send({
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
          href: `${environment.frontendUrl}/.well-known/nodeinfo/2.0`
        }
      ]
    })
    res.end()
  })

  app.get('/.well-known/nodeinfo/2.0', routeCache.cacheSeconds(300), async (req, res) => {
    const localUsers = await User.count({
      where: {
        remoteInbox: { [Op.eq]: null }
      }
    })
    if (new Date().getTime() - lastTimeCached.getTime() > 1000 * 3600 * 3) {
      lastTimeCached = new Date()
      const activeUsersSixMonths = await sequelize.query(`SELECT COUNT(*) AS count
    FROM users
    WHERE id IN (
      SELECT userId
      FROM posts
      WHERE createdAt between date_sub(now(),INTERVAL 6 MONTH) and now()
      GROUP BY userId
      HAVING COUNT(1) > 0
    ) AND url NOT LIKE '@%'`)

      const activeUsersLastMonth = await sequelize.query(`SELECT COUNT(*) AS count
    FROM users
    WHERE id IN (
      SELECT userId
      FROM posts
      WHERE createdAt between date_sub(now(),INTERVAL 1 MONTH) and now()
      GROUP BY userId
      HAVING COUNT(1) > 0
    ) AND url NOT LIKE '@%'`)
      activeUsersMonthCached = activeUsersLastMonth[0][0].count
      activeUsersHalfYearCached = activeUsersSixMonths[0][0].count
    }

    res.send({
      version: '2.0',
      software: {
        name: 'wafrn',
        version: '0.0.2'
      },
      protocols: ['activitypub'],
      services: {
        outbound: [],
        inbound: []
      },
      usage: {
        users: {
          total: localUsers,
          activeMonth: activeUsersMonthCached,
          activeHalfyear: activeUsersHalfYearCached
        },
        localPosts: await Post.count({
          where: {
            literal: sequelize.literal(`userId in (SELECT id FROM users where url NOT LIKE '@%')`),
            privacy: 0
          }
        })
      },
      openRegistrations: true,
      metadata: {}
    })
    res.end()
  })
}

export { wellKnownRoutes }
