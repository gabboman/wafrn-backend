import { Application, Response } from 'express'
import { Op, Sequelize } from 'sequelize'
import { Follows, Post, PostMentionsUserRelation, PostReport, User, UserLikesPostRelations } from '../db'
import { authenticateToken } from '../utils/authenticateToken'

import { sequelize } from '../db'
import getStartScrollParam from '../utils/getStartScrollParam'
import { environment } from '../environment'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { getMutedPosts } from '../utils/cacheGetters/getMutedPosts'
import getBlockedIds from '../utils/cacheGetters/getBlockedIds'

export default function notificationRoutes(app: Application) {
  app.get('/api/v2/notificationsScroll', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId ? req.jwtData?.userId : ''
    User.findByPk(userId).then(async (usr: any) => {
      if (usr) {
        usr.lastTimeNotificationsCheck = new Date()
        await usr.save()
      }
    })
    // MULTIPLE DATES ON SAME ENDPOINT SO
    const likesDate = req.query?.likesDate ? new Date(req.query.likesDate as string) : new Date()
    const followsDate = req.query?.followsDate ? new Date(req.query.followsDate as string) : new Date()
    const reblogsDate = req.query?.reblogsDate ? new Date(req.query.reblogsDate as string) : new Date()
    const mentionsDate = req.query?.mentionsDate ? new Date(req.query.mentionsDate as string) : new Date()
    const reblogQuery: any = await getReblogQuery(userId, reblogsDate)
    reblogQuery.where.createdAt = {
      [Op.lt]: reblogsDate
    }
    const reblogs = await Post.findAll({
      ...reblogQuery,
      limit: environment.postsPerPage
    })

    const mentionsQuery: any = await getQueryMentions(userId)
    mentionsQuery.where = {
      ...mentionsQuery.where,
      createdAt: {
        [Op.lt]: mentionsDate
      }
    }
    const mentions = await Post.findAll({
      ...mentionsQuery,
      limit: environment.postsPerPage
    })
    const followsQuery: any = await getNewFollows(userId, followsDate)
    followsQuery.where.createdAt = {
      [Op.lt]: followsDate
    }
    const follows = Follows.findAll({
      ...followsQuery,
      limit: environment.postsPerPage
    })
    const likesQuery: any = await getQueryLikes(userId, likesDate)
    likesQuery.where.createdAt = {
      [Op.lt]: likesDate
    }
    const likes = UserLikesPostRelations.findAll({
      ...likesQuery,
      limit: environment.postsPerPage
    })
    await Promise.all([reblogs, mentions, follows, likes])
    res.send({
      reblogs: await reblogs,
      likes: await likes,
      mentions: await mentions,
      follows: (await follows).map((follow: any) => {
        return { ...follow.followed.dataValues, createdAt: follow.createdAt }
      })
    })
  })

  app.get('/api/v2/notificationsCount', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId ? req.jwtData?.userId : ''
    //const blockedUsers = await getBlockedIds(userId)
    const startCountDate = (await User.findByPk(userId)).lastTimeNotificationsCheck
    const mentionsQuery: any = await getQueryMentions(userId)
    mentionsQuery.where = {
      ...mentionsQuery.where,
      createdAt: {
        [Op.gt]: startCountDate
      }
    }
    const postMentions = Post.count(mentionsQuery)
    const newPostReblogs = Post.count(await getReblogQuery(userId, startCountDate))

    const newFollows = Follows.count(await getNewFollows(userId, startCountDate))

    const newLikes = UserLikesPostRelations.count(await getQueryLikes(userId, startCountDate))

    let reports = 0
    let awaitingAproval = 0

    if (req.jwtData?.role === 10) {
      // well the user is an admin!
      reports = PostReport.count({
        where: {
          resolved: false
        }
      })
      awaitingAproval = User.count({
        where: {
          activated: false,
          url: {
            [Op.notLike]: '%@%'
          },
          banned: false
        }
      })
    }

    await Promise.all([newFollows, postMentions, newLikes, reports, awaitingAproval, newPostReblogs])

    res.send({
      notifications: (await newFollows) + (await postMentions) + (await newLikes) + (await newPostReblogs),
      reports: await reports,
      awaitingAproval: await awaitingAproval
    })
  })
  async function getQueryMentions(userId: string) {
    return {
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['url', 'name', 'id', 'avatar']
        },
        {
          model: User,
          as: 'mentionPost',
          attributes: ['id'],
          where: {
            id: userId
          },
          required: true
        }
      ],
      where: {
        parentId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        userId: {
          [Op.notIn]: [userId].concat(await getBlockedIds(userId))
        }
      }
    }
  }

  async function getQueryLikes(userId: string, startCountDate: Date) {
    return {
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Post,
          required: true,
          attributes: ['userId'],
          where: {
            userId: userId
          }
        },
        {
          model: User,
          attributes: ['url', 'name', 'id', 'avatar']
        }
      ],
      where: {
        postId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        createdAt: {
          [Op.gt]: startCountDate
        },
        userId: {
          [Op.notIn]: await getBlockedIds(userId)
        }
      }
    }
  }

  async function getNewFollows(userId: string, startCountDate: Date) {
    return {
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'followed',
          attributes: ['url', 'avatar', 'name', 'remoteId']
        }
      ],
      where: {
        followerId: {
          [Op.notIn]: await getBlockedIds(userId)
        },
        createdAt: {
          [Op.gt]: startCountDate
        },
        followedId: userId
      }
    }
  }

  // TODO optimize this in a way that a reblog reply only counts as a mention
  async function getReblogQuery(userId: string, startCountDate: Date) {
    // TODO FIX DIRTY HACK AHEAD: lets get A LOT of mentions
    const mentions = await PostMentionsUserRelation.findAll({
      order: [['createdAt', 'DESC']],
      limit: environment.postsPerPage * 10,
      where: {
        userId: userId
      }
    })
    return {
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Post,
          as: 'ancestors',
          required: true,
          attributes: ['userId', 'content', 'id'],
          where: {
            userId: userId
          }
        },
        {
          model: User,
          as: 'user',
          attributes: ['url', 'avatar', 'name', 'remoteId']
        }
      ],
      where: {
        id: {
          [Op.notIn]: mentions.map((ment: any) => ment.postId)
        },
        parentId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        privacy: {
          [Op.ne]: 10
        },
        createdAt: {
          [Op.gt]: startCountDate
        },
        userId: {
          [Op.notIn]: [userId].concat(await getBlockedIds(userId))
        }
      }
    }
  }
}
