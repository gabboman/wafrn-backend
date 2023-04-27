import { Application } from 'express'
import { Op, Sequelize } from 'sequelize'
import { Post, PostMentionsUserRelation, User, UserLikesPostRelations } from '../db'
import authenticateToken from '../utils/authenticateToken'
import getBlockedIds from '../utils/getBlockedIds'
import getReblogs from '../utils/getReblogs'
import { logger } from '../utils/logger'
import { sequelize } from '../db'
import getStartScrollParam from '../utils/getStartScrollParam'
import { environment } from '../environment'


export default function notificationRoutes (app: Application) {
  app.post('/readNotifications', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.jwtData.userId
      const user = await User.findOne({
        where: {
          id: userId
        }
      })
      if (req.body.time) {
        user.lastTimeNotificationsCheck = new Date().setTime(req.body.time)
        user.save()
      }
    } catch (error) {
      logger.error(error)
    }
    res.send({
      success: true
    })
  })

  app.get('/notifications', authenticateToken, async (req: any, res) => {
    const userId = req.jwtData.userId
    const user = await User.findOne({
      where: {
        id: userId
      }
    })
    const blockedUsers = await getBlockedIds(userId)
    const perPostReblogs = getReblogs(user)
    const newFollows = user.getFollower({
      where: {
        createdAt: {
          [Op.gt]: new Date(user.lastTimeNotificationsCheck)
        }
      },
      attributes: ['url', 'avatar']
    })
    const newMentions = PostMentionsUserRelation.findAll({
      where: {
        createdAt: {
          [Op.gt]: new Date(user.lastTimeNotificationsCheck)
        },
        userId
      },
      include: [
        {
          model: Post,
          include: [
            {
              model: User,
              attributes: ['avatar', 'url', 'description', 'id']
            }
          ]
        }
      ]
    })

    const newLikes = UserLikesPostRelations.findAll({
      where: {
        createdAt: {
          [Op.gt]: new Date(user.lastTimeNotificationsCheck)
        },
        literal: sequelize.literal(`postId in (select id from posts where userId like "${userId}")`)
      },
      include: [
        {
          model: User,
          attributes: ['avatar', 'url', 'description', 'id']
        }
      ]
    })
    res.send({
      follows: (await newFollows).filter(
        (newFollow: any) => !blockedUsers.includes(newFollow.id)
      ),
      reblogs: (await perPostReblogs).filter(
        (newReblog: any) => !blockedUsers.includes(newReblog.user.id)
      ),
      mentions: (await newMentions)
        .filter((newMention: any) => {
          return !blockedUsers.includes(newMention.post.userId)
        })
        .map((mention: any) => {
          return {
            user: mention.post.user,
            content: mention.post.content,
            id: mention.post.id,
            createdAt: mention.createdAt,
            parentId: mention.post.parentId
          }
        }),
      likes: await newLikes
    })
  })

  app.get('/notificationsScroll', authenticateToken, async (req: any, res) => {
    const page = Number(req?.query.page) || 0
    const userId = req.jwtData.userId
    const user = await User.findOne({
      where: {
        id: userId
      }
    })
    const blockedUsers = await getBlockedIds(userId)
    const perPostReblogs = await  Post.findAll({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        literal: Sequelize.literal(`posts.id IN (select postsId from postsancestors where ancestorId in (select id from posts where userId like "${userId}")) AND userId NOT LIKE "${userId}"`)
      },
      include: [
        {
          model: User,
          attributes: ['avatar', 'url', 'description', 'id']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: environment.postsPerPage,
      offset: page * environment.postsPerPage
    })
    const newFollows = await user.getFollower({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        }
      },
      attributes: ['url', 'avatar', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: environment.postsPerPage,
      offset: page * environment.postsPerPage
    })
    const newMentions = PostMentionsUserRelation.findAll({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        userId
      },
      include: [
        {
          model: Post,
          include: [
            {
              model: User,
              attributes: ['avatar', 'url', 'description', 'id']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: environment.postsPerPage,
      offset: page * environment.postsPerPage
    })

    const newLikes = UserLikesPostRelations.findAll({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        literal: sequelize.literal(`postId in (select id from posts where userId like "${userId}")`)
      },
      include: [
        {
          model: User,
          attributes: ['avatar', 'url', 'description', 'id']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: environment.postsPerPage,
      offset: page * environment.postsPerPage
    })
    res.send({
      follows: await newFollows,
      reblogs: await perPostReblogs,
      mentions: (await newMentions)
        .map((mention: any) => {
          return {
            user: mention.post.user,
            content: mention.post.content,
            id: mention.post.id,
            createdAt: mention.createdAt,
            parentId: mention.post.parentId,
            privacy: mention.post.privacy,
          }
        }),
      likes: await newLikes
    })
  })

}
