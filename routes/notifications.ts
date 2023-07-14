import { Application, Response } from 'express'
import { Op, Sequelize } from 'sequelize'
import { Follows, Post, PostMentionsUserRelation, User, UserLikesPostRelations } from '../db'
import { authenticateToken } from '../utils/authenticateToken'

import { sequelize } from '../db'
import getStartScrollParam from '../utils/getStartScrollParam'
import { environment } from '../environment'
import AuthorizedRequest from '../interfaces/authorizedRequest'

export default function notificationRoutes(app: Application) {
  app.get('/api/notificationsScroll', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const page = Number(req?.query.page) || 0
    const userId = req.jwtData?.userId
    // const blockedUsers = await getBlockedIds(userId)
    const perPostReblogs = await Post.findAll({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        literal: Sequelize.literal(
          `posts.id IN (select postsId from postsancestors where ancestorId in (select id from posts where userId = "${userId}")) AND userId NOT LIKE "${userId}" AND  posts.userId not in (select blockedId from blocks where blockerId = "${userId}")`
        )
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['avatar', 'url', 'description', 'id']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: environment.postsPerPage,
      offset: page * environment.postsPerPage
    })

    const newFollowsQuery = await Follows.findAll({
      where: {
        literal: sequelize.literal(`followerId not in (select blockedId from blocks where blockerId = "${userId}")`),
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        followedId: userId
      },
      attributes: ['createdAt'],
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
    const newFollows = newFollowsQuery.map((elem: any) => {
      return {
        createdAt: elem.createdAt,
        url: elem.followed.url,
        avatar: elem.followed.avatar
      }
    })
    // TODO FIX
    const newMentions = await Post.findAll({
      where: {
        literal: sequelize.literal(
          `posts.id in (select postId from postMentionsUserRelations where userId = "${userId}")
          AND
          posts.userId not in (select blockedId from blocks where blockerId = "${userId}")`
        ),
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['avatar', 'url', 'description', 'id']
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
        literal: sequelize.literal(`postId in (select id from posts where userId like "${userId}")
        AND
        userId not in (select blockedId from blocks where blockerId = "${userId}")`)
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
          user: mention?.user,
          content: mention.content,
          id: mention.id,
          createdAt: mention.createdAt,
          parentId: mention.parentId,
          privacy: mention.privacy
        }
      }),
      likes: await newLikes
    })
  })

  app.get('/api/notificationsCount', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId
    //const blockedUsers = await getBlockedIds(userId)
    const perPostReblogs = await Post.count({
      where: {
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        literal: Sequelize.literal(
          `posts.id IN (select postsId from postsancestors where ancestorId in (select id from posts where userId = "${userId}")) AND userId NOT LIKE "${userId}" AND  posts.userId not in (select blockedId from blocks where blockerId = "${userId}")`
        )
      }
    })
    const newFollows = await Follows.count({
      where: {
        literal: sequelize.literal(`followerId not in (select blockedId from blocks where blockerId = "${userId}")`),
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        followedId: userId
      }
    })
    const newMentions = PostMentionsUserRelation.count({
      where: {
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        userId
      },
      attributes: ['postId']
    })

    const newLikes = UserLikesPostRelations.count({
      where: {
        createdAt: {
          [Op.gt]: getStartScrollParam(req)
        },
        literal: sequelize.literal(`postId in (select id from posts where userId like "${userId}") AND
        userId not in (select blockedId from blocks where blockerId = "${userId}")`)
      },
      attributes: ['postId']
    })

    res.send({
      notifications: (await newFollows) + (await perPostReblogs) + (await newMentions) + (await newLikes)
    })
  })
}
