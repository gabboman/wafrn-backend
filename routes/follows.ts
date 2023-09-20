import { Application, Response } from 'express'
import { Blocks, Follows, User } from '../db'
import { authenticateToken } from '../utils/authenticateToken'

import getBlockedIds from '../utils/getBlockedIds'
import { logger } from '../utils/logger'
import { remoteFollow } from '../utils/activitypub/remoteFollow'
import { remoteUnfollow } from '../utils/activitypub/remoteUnfollow'
import { Op, Sequelize } from 'sequelize'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { follow } from '../utils/follow'
import { redisCache } from '../utils/redis'

export default function followsRoutes(app: Application) {
  app.post('/api/follow', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    try {
      const posterId = req.jwtData?.userId
      if (req.body?.userId && posterId) {
        success = await follow(posterId, req.body.userId, res)
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
        redisCache.del('follows:full:' + posterId)
        redisCache.del('follows:local:' + posterId)
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
    const followedUsers = Follows.findAll({
      where: {
        followerId: req.jwtData?.userId
      }
    })
    const blockedUsers = getBlockedIds(req.jwtData?.userId as string)

    Promise.all([followedUsers, blockedUsers])
    res.send({
      followedUsers: (await followedUsers).map((elem: any) => elem.followedId).concat(req.jwtData?.userId),
      blockedUsers: await blockedUsers
    })
  })
}
