import { Application } from 'express'
import { User } from '../db'
import authenticateToken from '../utils/authenticateToken'
import { logger } from '../utils/logger'

export default function blockRoutes(app: Application) {
  app.post('/block', authenticateToken, async (req: any, res) => {
    let success = false
    try {
      const posterId = req.jwtData.userId
      if (req.body?.userId) {
        const userBlocked = await User.findOne({
          where: {
            id: req.body.userId
          }
        })
        userBlocked.addBlocker(posterId)
        userBlocked.removeFollowed(posterId)
        success = true
      }
    } catch (error) {
      logger.error(error)
    }

    res.send({
      success
    })
  })

  app.post('/unblock', authenticateToken, async (req: any, res) => {
    let success = false
    const posterId = req.jwtData.userId
    if (req.body?.userId) {
      const userUnblocked = await User.findOne({
        where: {
          id: req.body.userId
        }
      })

      userUnblocked.removeBlocker(posterId)
      success = true
    }

    res.send({
      success
    })
  })
}
