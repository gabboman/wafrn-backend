import { Application } from 'express'
import { User } from '../db'
import authenticateToken from '../utils/authenticateToken'
import getBlockedIds from '../utils/getBlockedIds'
import getFollowedsIds from '../utils/getFollowedsIds'
import { logger } from '../utils/logger'
import { remoteFollow } from '../utils/activitypub/remoteFollow'
import { remoteUnfollow } from '../utils/activitypub/remoteUnfollow'
import { Sequelize } from 'sequelize'

export default function followsRoutes(app: Application) {
  app.post('/api/follow', authenticateToken, async (req: any, res) => {
    // TODO remote user follow
    let success = false
    try {
      const posterId = req.jwtData.userId
      if (req.body?.userId) {
        const userFollowed = await User.findOne({
          where: {
            id: req.body.userId
          }
        })

        userFollowed.addFollower(posterId)
        success = true
        if (userFollowed.remoteId) {
          const localUser = await User.findOne({ where: { id: posterId } })
          remoteFollow(localUser, userFollowed)
            .then(() => {})
            .catch((error) => {
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

  app.post('/api/unfollow', authenticateToken, async (req: any, res) => {
    // TODO remote user unfollow
    let success = false
    try {
      const posterId = req.jwtData.userId
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

  app.get('/api/getFollowedUsers', authenticateToken, async (req: any, res) => {
    // const followedUsers = getFollowedsIds(req.jwtData.userId)
    const followedUsers = await User.findAll({
      attributes: ['id'],
      where: {
        literal: Sequelize.literal(`id in (SELECT followedId from follows where followerId LIKE "${req.jwtData.userId}")`)
      }
    })
    //const blockedUsers = getBlockedIds(req.jwtData.userId)
    res.send({
      followedUsers: followedUsers.map((elem: any)=> elem.id).concat(req.jwtData.userId),
      //blockedUsers: await blockedUsers
      blockedUsers: []
    })
  })
}
