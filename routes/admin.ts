import { Application } from 'express'
import { adminToken } from '../utils/authenticateToken'
import { FederatedHost } from '../db'

export default function adminRoutes(app: Application) {
  app.get('/api/server-list', adminToken, async (req: any, res) => {
    res.send({
      servers: await FederatedHost.findAll()
    })
  })
}
