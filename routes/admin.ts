import { Application, Response } from 'express'
import { adminToken, authenticateToken } from '../utils/authenticateToken'
import { Blocks, FederatedHost, Post, PostReport, ServerBlock, User, sequelize } from '../db'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { server } from '../interfaces/server'
import { Op, Sequelize } from 'sequelize'
import Redis from 'ioredis'
import { environment } from '../environment'
const redis = new Redis(environment.redisioConnection)

export default function adminRoutes(app: Application) {
  app.get('/api/admin/server-list', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    res.send({
      servers: await FederatedHost.findAll()
    })
  })
  app.post('/api/admin/server-update', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    const petitionBody: Array<server> = req.body
    if (petitionBody) {
      const hostsToUpdateIds = petitionBody.map((elem) => elem.id)
      const dbElements = await FederatedHost.findAll({
        where: {
          id: {
            [Op.in]: hostsToUpdateIds
          }
        }
      })
      const promises: Array<Promise<any>> = []
      dbElements.forEach(async (elemToUpdate: any) => {
        const newValue = petitionBody.find((elem) => elem.id === elemToUpdate.id)
        if (newValue) {
          elemToUpdate.blocked = newValue.blocked
          elemToUpdate.detail = newValue.detail
          promises.push(elemToUpdate.save())
          if (elemToUpdate.blocked) {
            // we add it to the blocked cache
            redis.set('server:' + elemToUpdate.displayName, 'true')
          } else {
            // we remove it from the blocked cache
            redis.set('server:' + elemToUpdate.displayName, 'false')
          }
          if (newValue.blocked) {
            promises.push(
              PostReport.update(
                {
                  resolved: true
                },
                {
                  where: {
                    postId: {
                      [Op.in]: sequelize.literal(
                        `(select id from posts where userId in (SELECT id from users where federatedHostId="${elemToUpdate.id}"))`
                      )
                    }
                  }
                }
              )
            )
          }
        }
      })
      await Promise.all(promises)
      res.send({})
    } else {
      res.send({})
    }
  })

  app.get('/api/admin/userBlockList', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    res.send({
      userBlocks: await Blocks.findAll({
        include: [
          {
            model: User,
            as: 'blocker',
            attributes: ['url', 'avatar']
          },
          {
            model: User,
            as: 'blocked',
            attributes: ['url', 'avatar']
          }
        ]
      }),
      userServerBlocks: await ServerBlock.findAll({
        include: [
          {
            model: User,
            as: 'userBlocker',
            attributes: ['url', 'avatar']
          },
          {
            model: FederatedHost,
            as: 'blockedServer',
            attributes: ['displayName']
          }
        ]
      })
    })
  })

  app.get('/api/admin/reportCount', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    res.send({
      reports: await PostReport.count({
        where: {
          resolved: false
        }
      })
    })
  })

  function getReportList() {
    return PostReport.findAll({
      include: [
        {
          model: User,
          attributes: ['url', 'avatar', 'id']
        },
        {
          model: Post,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['url', 'avatar', 'id'],
              include: [
                {
                  model: FederatedHost,
                  attributes: ['id', 'displayName']
                }
              ]
            }
          ]
        }
      ]
    })
  }

  app.get('/api/admin/reportList', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    res.send(await getReportList())
  })

  app.post('/api/admin/closeReport', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    const reportToBeClosed = await PostReport.findByPk(req.body.id)
    reportToBeClosed.resolved = true
    await reportToBeClosed.save()
    res.send(await getReportList())
  })

  app.post('/api/admin/banUser', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    const userToBeBanned = await User.findByPk(req.body.id)
    userToBeBanned.banned = 1
    await userToBeBanned.save()
    const reportupdate = await PostReport.update(
      {
        resolved: true
      },
      {
        where: {
          postId: { [Op.in]: sequelize.literal(`(select id from posts where userId="${req.body.id}")`) }
        }
      }
    )
    res.send({
      success: true
    })
  })

  app.post('/api/admin/ignoreReport', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    res.send(
      await PostReport.update(
        {
          resolved: true
        },
        {
          where: {
            id: req.body.id
          }
        }
      )
    )
  })

  async function getBannedUsers() {
    return await User.findAll({
      where: {
        banned: true
      },
      attributes: ['id', 'url', 'avatar']
    })
  }

  app.get('/api/admin/getBannedUsers', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    res.send({
      users: await getBannedUsers()
    })
  })

  app.post('/api/admin/unbanUser', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    await User.update(
      {
        banned: false
      },
      {
        where: {
          id: req.body.id
        }
      }
    )
    res.send({
      users: await getBannedUsers()
    })
  })
}
