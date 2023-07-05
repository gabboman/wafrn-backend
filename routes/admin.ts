import { Application, Response } from 'express'
import { adminToken, authenticateToken } from '../utils/authenticateToken'
import { FederatedHost } from '../db'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { server } from '../interfaces/server'
import { Op } from 'sequelize'

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
      dbElements.forEach((elemToUpdate: any) => {
        const newValue = petitionBody.find((elem) => elem.id === elemToUpdate.id)
        if (newValue) {
          elemToUpdate.blocked = newValue.blocked
          elemToUpdate.detail = newValue.detail
          promises.push(elemToUpdate.save())
        }
      })
      await Promise.allSettled(promises)
      res.send({})
    } else {
      res.send({})
    }
  })
}
