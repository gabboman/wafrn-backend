import { Application, Response } from 'express'
import { User, Mutes, FederatedHost, ServerBlock } from '../db'
import { authenticateToken } from '../utils/authenticateToken'
import { logger } from '../utils/logger'
import AuthorizedRequest from '../interfaces/authorizedRequest'

export default function blockUserServerRoutes(app: Application) {
  
  app.post('/api/blockUserServer', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    try {
      const posterId = req.jwtData?.userId
      const userBlocker = await User.findByPk(posterId,)
      if (req.body?.userId) {
        const userToGetServerBlocked = await User.findByPk(req.body.userId, {
          include: [
            {
              model: FederatedHost,
            }
          ]
        })
        if(userToGetServerBlocked) {
           await ServerBlock.create({
            userBlockerId: userBlocker.id,
            blockedServerId: userToGetServerBlocked.federatedHost.id
          })
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

  app.post('/api/unblockUserServer', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    const posterId = req.jwtData?.userId
    if (req.body?.userId) {
      const userUnmuted = await User.findByPk(req.body.userId)
      userUnmuted.removeMuter(posterId)
      success = true
    }
    res.send({
      success
    })
  })

  async function myServerBlocks(id: string) {
    return Mutes.findAll({
      where: {
        blockerId: id
      },
      attributes: [
        'reason',
        'createdAt'
      ],
      include: [
        {
          model: User,
          as: 'muted',
          attributes: ['id', 'url', 'avatar', 'description']
        }
      ]
    })
  }


  app.get('/api/myServerBlocks', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const posterId = req.jwtData?.userId as string
    const mutes = await myServerBlocks(posterId);
    res.send(mutes)
  })

  app.post('/api/unmute-user', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userToBeUnmuted = req.query.id;
    const userUnmuterId = req.jwtData?.userId as (string);
    await Mutes.destroy({
      where: {
        mutedId: userToBeUnmuted,
        muterId: userUnmuterId,
      }
    });
    res.send(await myServerBlocks(userUnmuterId))
  })


}
