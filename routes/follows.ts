import { Application, Response } from 'express'
import { Blocks, User } from '../db'
import { authenticateToken } from '../utils/authenticateToken'

import getBlockedIds from '../utils/getBlockedIds'
import { logger } from '../utils/logger'
import { remoteFollow } from '../utils/activitypub/remoteFollow'
import { remoteUnfollow } from '../utils/activitypub/remoteUnfollow'
import { Op, Sequelize } from 'sequelize'
import AuthorizedRequest from '../interfaces/authorizedRequest'

export default function followsRoutes(app: Application) {
  app.post('/api/follow', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    // TODO remote user follow
    let success = false
    try {
      const posterId = req.jwtData?.userId
      if (req.body?.userId) {
        const userFollowed = await User.findOne({
          where: {
            id: req.body.userId
          }
        })
        const blocksExisting = await Blocks.count({
          where: {
            [Op.or]: [
              {
                blockerId: posterId,
                blockedId: { [Op.in]: [req.body.userId] }
              },
              {
                blockedId: posterId,
                blockerId: { [Op.in]: [req.body.userId] }
              }
            ]
          }
        })
        if (blocksExisting > 0) {
          res.sendStatus(500)
          res.send({
            error: true,
            message: 'You can not follow someone who you have blocked, nor who has blocked you'
          })
        }
        userFollowed.addFollower(posterId)
        success = true
        if (userFollowed.remoteId) {
          const localUser = await User.findOne({ where: { id: posterId } })
          await remoteFollow(localUser, userFollowed).catch((error) => {
            logger.info('error following remote user')
          })
        }
      }
    } catch (error) {
      logger.error(error)
    }

    res.send({
      success
    })
  })

  app.post('/api/unfollow', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    // TODO remote user unfollow
    let success = false
    try {
      const posterId = req.jwtData?.userId
      if (req.body?.userId) {
        const userUnfollowed = await User.findOne({
          where: {
            id: req.body.userId
          }
        })

        if (userUnfollowed.remoteId) {
          const localUser = await User.findOne({ where: { id: posterId } })
          remoteUnfollow(localUser, userUnfollowed)
            //.then(() => {})
            .catch((error) => {
              logger.info('error unfollowing remote user')
            })
        }

        userUnfollowed.removeFollower(posterId)
        success = true
      }
    } catch (error) {
      logger.error(error)
    }

    res.send({
      success
    })
  })

  app.get('/api/getFollowedUsers', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    // const followedUsers = getFollowedsIds(req.jwtData?.userId)
    const followedUsers = await User.findAll({
      attributes: ['id'],
      where: {
        literal: Sequelize.literal(
          `id in (SELECT followedId from follows where followerId LIKE "${req.jwtData?.userId}")`
        )
      }
    })
    const blockedUsers = getBlockedIds(req.jwtData?.userId as string)
    res.send({
      followedUsers: followedUsers.map((elem: any) => elem.id).concat(req.jwtData?.userId),
      blockedUsers: await blockedUsers
    })
  })
}
