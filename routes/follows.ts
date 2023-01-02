import { Application } from 'express'
import { User } from '../models'
import authenticateToken from '../utils/authenticateToken'
import getBlockedIds from '../utils/getBlockedIds'
import getFollowedsIds from '../utils/getFollowedsIds'

export default function followsRoutes (app: Application) {
  app.post('/follow', authenticateToken, async (req: any, res) => {
    // TODO remote user follow
    let success = false
    try {
      const posterId = req.jwtData.userId
      if (req.body && req.body.userId) {
        const userFollowed = await User.findOne({
          where: {
            id: req.body.userId
          }
        })

        userFollowed.addFollower(posterId)
        success = true
      }
    } catch (error) {
      console.error(error)
    }

    res.send({
      success
    })
  })

  app.post('/unfollow', authenticateToken, async (req: any, res) => {
    // TODO remote user unfollow
    let success = false
    try {
      const posterId = req.jwtData.userId
      if (req.body && req.body.userId) {
        const userUnfollowed = await User.findOne({
          where: {
            id: req.body.userId
          }
        })

        userUnfollowed.removeFollower(posterId)
        success = true
      }
    } catch (error) {
      console.error(error)
    }

    res.send({
      success
    })
  })

  app.get('/getFollowedUsers', authenticateToken, async (req: any, res) => {
    const followedUsers = getFollowedsIds(req.jwtData.userId)
    const blockedUsers = getBlockedIds(req.jwtData.userId)
    await Promise.all([followedUsers, blockedUsers])
    res.send({
      followedUsers: await followedUsers,
      blockedUsers: await blockedUsers
    })
  })
}
