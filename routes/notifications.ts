import { Application, Response } from 'express'
import { Op, Sequelize } from 'sequelize'
import { Follows, Post, PostMentionsUserRelation, User, UserLikesPostRelations } from '../db'
import { authenticateToken } from '../utils/authenticateToken'

import { sequelize } from '../db'
import getStartScrollParam from '../utils/getStartScrollParam'
import { environment } from '../environment'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { getMutedPosts } from '../utils/cacheGetters/getMutedPosts'

export default function notificationRoutes(app: Application) {
  app.get('/api/notificationsScroll', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const page = Number(req?.query.page) || 0
    const userId = req.jwtData?.userId as string;
    if (page === 0) {
      // we update the lasttimenotificationscheck
      User.findByPk(userId).then(async (user: any) => {
        user.lastTimeNotificationsCheck = new Date()
        await user.save()
      })
    }
    // const blockedUsers = await getBlockedIds(userId)
    const perPostReblogs = await Post.findAll({
      where: {
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        parentId: {
          [Op.notIn]: await getMutedPosts(userId)
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
    // TODO use the new function instead.
    /*
    We remove this block and instead we generate the object by checking if the posts have content or not
    */
    const newMentions = await Post.findAll({
      where: {
        id: {
          [Op.notIn]: await getMutedPosts(userId)
        },
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
        postId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
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
    const userId = req.jwtData?.userId ? req.jwtData?.userId : ''
    //const blockedUsers = await getBlockedIds(userId)
    const startCountDate = (await User.findByPk(userId)).lastTimeNotificationsCheck

    const postNotifications = Post.count(await getQueryReblogsMentions(userId, startCountDate))

    const newFollows = Follows.count({
      where: {
        literal: sequelize.literal(`followerId not in (select blockedId from blocks where blockerId = "${userId}")`),
        createdAt: {
          [Op.gt]: startCountDate
        },
        followedId: userId
      }
    })

    const newLikes = UserLikesPostRelations.count({
      where: {
        postId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        parentId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        createdAt: {
          [Op.gt]: startCountDate
        },
        literal: sequelize.literal(`postId in (select id from posts where userId like "${userId}") AND
        userId not in (select blockedId from blocks where blockerId = "${userId}")`)
      }
    })

    await Promise.all([newFollows, postNotifications, newLikes])

    res.send({
      notifications: (await newFollows) + (await postNotifications) + (await newLikes)
    })
  })

  async function getQueryReblogsMentions(userId: string, date: Date) {
    return {
      where: {
        id: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        createdAt: {
          [Op.gt]: date
        },
        userId: {
          [Op.notIn]: sequelize.literal(`(select blockedId from blocks where blockerId = "${userId}")`)
        },
        [Op.or]: [
          {
            literal: Sequelize.literal(
              `posts.id IN (select id from posts where parentId in (select id from posts where userId = "${userId}")) AND posts.userId NOT LIKE "${userId}"`
            )
          },
          {
            literal: Sequelize.literal(
              `posts.id in (select postId from postMentionsUserRelations where userId = "${userId}")`
            )
          }
        ]
      }
    }
  }
}
