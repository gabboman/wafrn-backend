import { Application } from 'express'
import { Post, User, sequelize } from '../../db'
import { environment } from '../../environment'
import { return404 } from '../../utils/return404'
import { Op } from 'sequelize'

function wellKnownRoutes(app: Application) {
  // webfinger protocol
  app.get('/.well-known/host-meta', (req: any, res) => {
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?><XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"><Link rel="lrdd" template="${environment.frontendUrl}/.well-known/webfinger?resource={uri}"/></XRD>`
    )
    res.end()
  })
  app.get('/.well-known/webfinger/', async (req: any, res) => {
    if (req.query?.resource) {
      const urlQueryResource: string = req.query.resource
      if (urlQueryResource.startsWith('acct:') && urlQueryResource.endsWith(environment.instanceUrl)) {
        const userUrl = urlQueryResource.slice(5).slice(0, -(environment.instanceUrl.length + 1))
        const user = await User.cache(userUrl).findOne({
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

  app.get('/.well-known/nodeinfo', (req, res) => {
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

  app.get('/.well-known/nodeinfo/2.0', async (req, res) => {
    const localUsersIds = await User.findAll({
      where: {
        remoteInbox: { [Op.eq]: null }
      },
      attributes: ['id']
    })

    const activeUsersSixMonths = await sequelize.query(` SELECT id
      FROM users
      WHERE id IN (
        SELECT "userId"
        FROM posts
        WHERE "createdAt" between CURRENT_DATE - INTERVAL '6 months'  and CURRENT_DATE
        GROUP BY "userId"
        HAVING COUNT(1) > 0
      ) AND url NOT LIKE '@%';`)

    const activeUsersLastMonth = await sequelize.query(` SELECT id
    FROM users
    WHERE id IN (
      SELECT "userId"
      FROM posts
      WHERE "createdAt" between CURRENT_DATE - INTERVAL '1 months'  and CURRENT_DATE
      GROUP BY "userId"
      HAVING COUNT(1) > 0
    ) AND url NOT LIKE '@%';`)

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
          total: localUsersIds.length,
          activeMonth: activeUsersLastMonth[0].length,
          activeHalfyear: activeUsersSixMonths[0].length
        },
        localPosts: (
          await Post.findAll({
            attributes: ['id'],
            where: {
              userId: { [Op.in]: localUsersIds.map((user: any) => user.id) },
              privacy: 0
            }
          })
        ).length
      },
      openRegistrations: true,
      metadata: {}
    })
    res.end()
  })
}

export { wellKnownRoutes }
