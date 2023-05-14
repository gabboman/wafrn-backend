import { Application } from 'express'
import { Op, Sequelize } from 'sequelize'
import { Follows, Post, PostMentionsUserRelation, User, UserLikesPostRelations } from '../db'
import authenticateToken from '../utils/authenticateToken'
import getBlockedIds from '../utils/getBlockedIds'
import getReblogs from '../utils/getReblogs'
import { logger } from '../utils/logger'
import { sequelize } from '../db'
import getStartScrollParam from '../utils/getStartScrollParam'
import { environment } from '../environment'

export default function notificationRoutes(app: Application) {
  app.post('/api/readNotifications', authenticateToken, async (req: any, res) => {
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

  app.get('/api/notificationsScroll', authenticateToken, async (req: any, res) => {
    const page = Number(req?.query.page) || 0
    const userId = req.jwtData.userId
    const user = await User.findOne({
      where: {
        id: userId
      }
    })
    // const blockedUsers = await getBlockedIds(userId)
    const perPostReblogs = await Post.findAll({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        literal: Sequelize.literal(
          `posts.id IN (select postsId from postsancestors where ancestorId in (select id from posts where userId like "${userId}")) AND userId NOT LIKE "${userId}"`
        )
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

    const newFollowsQuery = await Follows.findAll({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        followerId: userId
      },
      attributes: [
        'createdAt'
      ],
      include: [
        {
          model: User,
          as: 'followed',
          attributes: ['url', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: environment.postsPerPage,
      offset: page * environment.postsPerPage
    })
    const newFollows = newFollowsQuery.map((elem: any) => { return {
      createdAt: elem.createdAt,
      url: elem.followed.url,
      avatar: elem.followed.avatar
    }});
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
      mentions: (await newMentions).map((mention: any) => {
        return {
          user: mention.post.user,
          content: mention.post.content,
          id: mention.post.id,
          createdAt: mention.createdAt,
          parentId: mention.post.parentId,
          privacy: mention.post.privacy
        }
      }),
      likes: await newLikes
    })
  })

  // TODO: do it better with a count instead of this thing you've done here
  app.get('/api/notificationsCount', authenticateToken, async (req: any, res) => {
    const tmp = getStartScrollParam(req)
    const userId = req.jwtData.userId
    const user = await User.findOne({
      where: {
        id: userId
      }
    })
    //const blockedUsers = await getBlockedIds(userId)
    const perPostReblogs = await Post.findAll({
      where: {
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        literal: Sequelize.literal(
          `posts.id IN (select postsId from postsancestors where ancestorId in (select id from posts where userId like "${userId}")) AND userId NOT LIKE "${userId}"`
        )
      },
      attributes: ['id']
    })
    const newFollows = await Follows.findAll({
      where: {
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        followerId: userId
      },
      attributes: [
        'createdAt'
      ],
    })
    const newMentions = PostMentionsUserRelation.findAll({
      where: {
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        userId
      },
      attributes: ['postId']
    })

    const newLikes = UserLikesPostRelations.findAll({
      where: {
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        literal: sequelize.literal(`postId in (select id from posts where userId like "${userId}")`)
      },
      attributes: ['postId']
    })

    res.send({
      notifications:
        (await newFollows).length + (await perPostReblogs).length + (await newMentions).length + (await newLikes).length
    })
  })
}
