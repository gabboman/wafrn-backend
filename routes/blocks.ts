import { Application, Response } from 'express'
import { User, Blocks } from '../db'
import { authenticateToken } from '../utils/authenticateToken'
import { logger } from '../utils/logger'
import AuthorizedRequest from '../interfaces/authorizedRequest'

export default function blockRoutes(app: Application) {
  app.post('/api/block', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    try {
      const posterId = req.jwtData?.userId
      const userBlocker = await User.findByPk(posterId)
      if (req.body?.userId) {
        const userToBeBlocked = await User.findByPk(req.body.userId)
        if(userToBeBlocked) {
          userToBeBlocked.addBlocker(userBlocker)
          userToBeBlocked.removeFollowed(userBlocker)
          userBlocker.removeFollowed(userToBeBlocked)
        }
        

        success = true
      }
    } catch (error) {
      logger.error(error)
    }

    res.send({
      success
    })
  })

  app.post('/api/unblock', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    const posterId = req.jwtData?.userId
    if (req.body?.userId) {
      const userUnblocked = await User.findByPk(req.body.userId)
      userUnblocked.removeBlocker(posterId)
      success = true
    }

    res.send({
      success
    })
  })

  app.get('/api/myBlocks', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const posterId = req.jwtData?.userId as string
    const blocks = await Blocks.findAll({
      where: {
        blockerId: posterId
      },
      attributes: [
        'reason',
        'createdAt'
      ],
      include: [
        {
          model: User,
          as: 'blocked',
          attributes: ['url', 'avatar', 'description']
        }
      ]
    })
    res.send(blocks)
  })
}
