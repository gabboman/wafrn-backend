import { Application, Response } from 'express'
import { Op, Sequelize } from 'sequelize'
import {
  Emoji,
  EmojiReaction,
  Follows,
  Post,
  PostEmojiRelations,
  PostMentionsUserRelation,
  PostReport,
  User,
  UserLikesPostRelations
} from '../db'
import { authenticateToken } from '../utils/authenticateToken'

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
    const emojiReactionDate = req.query?.emojiReactionDate
      ? new Date(req.query.emojiReactionDate as string)
      : new Date()

    const reblogQuery: any = await getReblogQuery(userId, reblogsDate)
    reblogQuery.where.createdAt = {
      [Op.lt]: reblogsDate
    }
    const reblogs = Post.findAll({
      ...reblogQuery,
      limit: environment.postsPerPage
    })

    const mentionedPostsId = (await getMentionedPostsId(userId, mentionsDate, Op.lt, true)).map(
      (mention: any) => mention.postId
    )

    const mentions = Post.findAll({
      where: {
        id: { [Op.in]: mentionedPostsId }
      }
    })
    const followsQuery: any = await getNewFollows(userId, followsDate)
    followsQuery.where.createdAt = {
      [Op.lt]: followsDate
    }

    const newEmojiReactions = getEmojiReactedPostsId(userId, emojiReactionDate, Op.lt, true)

    const follows = Follows.findAll({
      ...followsQuery,
      limit: environment.postsPerPage
    })
    const likes = getLikedPostsId(userId, likesDate, Op.lt, true)
    await Promise.all([reblogs, mentions, follows, likes, mentionedPostsId, newEmojiReactions])
    const postIds = (await mentionedPostsId).concat((await newEmojiReactions).map((react: any) => react.postId)).concat((await likes).map((like: any) => like.postId))
    let userIds = (await reblogs)
      .map((rb: any) => rb.userId)
      .concat((await newEmojiReactions).map((react: any) => react.userId))
      .concat((await follows).map((elem:any) => elem.followerId))
      .concat((await likes).map((like: any) => like.userId ))
    const posts = await Post.findAll({
      where: {
        id: {
          [Op.in]: postIds
        }
      }
    })
    userIds = userIds.concat(posts.map((post: any) => post.userId))
    const users = User.findAll({
      attributes: ['name', 'url', 'avatar', 'id'],
      where: {
        id: {
          [Op.in]: userIds
        }
      }
    })
    res.send({
      emojiReactions: await newEmojiReactions,
      users: await users,
      posts: await posts,
      reblogs: await reblogs,
      likes: await likes,
      mentions: await mentions,
      follows: (await follows)
    })
  })

  app.get('/api/v2/notificationsCount', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId ? req.jwtData?.userId : ''
    //const blockedUsers = await getBlockedIds(userId)
    const startCountDate = (await User.findByPk(userId)).lastTimeNotificationsCheck
    const mentionIds = await getMentionedPostsId(userId, startCountDate, Op.gt)
    const postMentions = mentionIds.length
    const newPostReblogs = Post.count(await getReblogQuery(userId, startCountDate))
    const newEmojiReactions = getEmojiReactedPostsId(userId, startCountDate, Op.gt)
    const newFollows = Follows.count(await getNewFollows(userId, startCountDate))

    const newLikes = (await getLikedPostsId(userId, startCountDate, Op.gt)).length

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

    await Promise.all([newFollows, postMentions, newLikes, reports, awaitingAproval, newPostReblogs, newEmojiReactions])

    res.send({
      notifications:
        (await newFollows) +
        (await postMentions) +
        (await newLikes) +
        (await newPostReblogs) +
        (await newEmojiReactions).length,
      reports: await reports,
      awaitingAproval: await awaitingAproval
    })
  })
  async function getMentionedPostsId(
    userId: string,
    startCountDate: Date,
    operator: any,
    limit?: boolean
  ): Promise<any[]> {
    return await PostMentionsUserRelation.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['postId', 'userId'],
      limit: limit ? environment.postsPerPage : Number.MAX_SAFE_INTEGER,
      where: {
        userId: userId,
        createdAt: {
          [operator]: startCountDate
        }
      }
    })
  }

  async function getLikedPostsId(userId: string, startCountDate: Date, operator: any, limit = false) {
    return await UserLikesPostRelations.findAll({
      order: [['createdAt', 'DESC']],
      limit: limit ? environment.postsPerPage : Number.MAX_SAFE_INTEGER,
      include: [
        {
          model: Post,
          required: true,
          attributes: [],
          where: {
            userId: userId
          }
        },
      ],
      where: {
        postId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        createdAt: {
          [operator]: startCountDate
        },
        userId: {
          [Op.notIn]: await getBlockedIds(userId)
        }
      }
    })
  }

  async function getEmojiReactedPostsId(
    userId: string,
    startCountDate: Date,
    operator: any,
    limit = false
  ): Promise<any[]> {
    return EmojiReaction.findAll({
      order: [['createdAt', 'DESC']],
      limit: limit ? environment.postsPerPage : Number.MAX_SAFE_INTEGER,
      include: [
        {
          model: Post,
          required: true,
          attributes: [],
          where: {
            userId: userId
          }
        }
      ],
      where: {
        postId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        createdAt: {
          [operator]: startCountDate
        },
        userId: {
          [Op.notIn]: await getBlockedIds(userId)
        }
      }
    })
  }

  async function getNewFollows(userId: string, startCountDate: Date) {
    return {
      order: [['createdAt', 'DESC']],
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

  async function getReblogQuery(userId: string, startCountDate: Date) {
    return {
      order: [['createdAt', 'DESC']],
      where: {
        content: '',
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
        },
        literal: Sequelize.literal(
          `posts.id IN (select id from posts where parentId in (select id from posts where userId = "${userId}"))`
        )
      }
    }
  }
}
