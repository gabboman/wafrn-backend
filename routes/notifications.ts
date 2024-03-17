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
  app.get('/api/notificationsScroll', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const page = Number(req?.query.page) || 0
    const userId = req.jwtData?.userId as string
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
        userId: {
          [Op.notIn]: await getBlockedIds(userId)
        },
        literal: Sequelize.literal(
          `posts.id IN (select postsId from postsancestors where ancestorId in (select id from posts where userId = "${userId}")) AND userId NOT LIKE "${userId}"`
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
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        followedId: userId,
        followerId: {
          [Op.notIn]: await getBlockedIds(userId)
        }
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
          `posts.id in (select postId from postMentionsUserRelations where userId = "${userId}")`
        ),
        createdAt: {
          [Op.lt]: getStartScrollParam(req)
        },
        userId: {
          [Op.notIn]: await getBlockedIds(userId)
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
        userId: {
          [Op.notIn]: await getBlockedIds(userId)
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

  app.get('/api/v2/notificationsScroll', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId ? req.jwtData?.userId : ''
    // MULTIPLE DATES ON SAME ENDPOINT SO
    const likesDate = req.query?.likesDate ? new Date(req.query.likesDate as string) : new Date()
    const followsDate = req.query?.followsDate ? new Date(req.query.followsDate as string) : new Date()
    const reblogsDate = req.query?.reblogsDate ? new Date(req.query.reblogsDate as string) : new Date()
    const mentionsDate = req.query?.mentionsDate ? new Date(req.query.mentionsDate as string) : new Date()
    const reblogs = Post.findAll({
      ...getReblogQuery(userId, reblogsDate),
      limit: environment.postsPerPage,
      order: [['createdAt', 'DESC']]
    })
    const mentions = Post.findAll({
      ...getQueryMentions(userId, mentionsDate),
      limit: environment.postsPerPage,
      order: [['createdAt', 'DESC']]
    })
    const follows = Follows.findAll({
      ...(await getNewFollows(userId, followsDate)),
      limit: environment.postsPerPage,
      order: [['createdAt', 'DESC']]
    })

    const likes = UserLikesPostRelations.findAll({
      ...(await getQueryLikes(userId, likesDate)),
      limit: environment.postsPerPage,
      order: [['createdAt', 'DESC']]
    })
    await Promise.all([reblogs, mentions, follows, likes])
    res.send({
      reblogs: await reblogs,
      likes: await likes,
      mentions: await mentions,
      follows: await follows
    })
  })

  app.get('/api/v2/notificationsCount', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId ? req.jwtData?.userId : ''
    //const blockedUsers = await getBlockedIds(userId)
    const startCountDate = (await User.findByPk(userId)).lastTimeNotificationsCheck

    const postMentions = Post.count(await getQueryMentions(userId, startCountDate))
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
  async function getQueryMentions(userId: string, date: Date) {
    const latestMentionsIds = (
      await PostMentionsUserRelation.findAll({
        attributes: ['postId'],
        where: {
          userId: userId,
          createdAt: {
            [Op.gt]: date
          }
        }
      })
    ).map((elem: any) => elem.postId)
    return {
      where: {
        id: {
          [Op.notIn]: await getMutedPosts(userId),
          [Op.in]: latestMentionsIds
        },
        parentId: {
          [Op.notIn]: await getMutedPosts(userId)
        },
        createdAt: {
          [Op.gt]: date
        },
        userId: {
          [Op.notIn]: (await getBlockedIds(userId)).push(userId)
        }
      }
    }
  }

  async function getQueryLikes(userId: string, startCountDate: Date) {
    return {
      include: [
        {
          model: Post,
          required: true,
          attributes: ['userId'],
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
    const mentions = await PostMentionsUserRelation.findAll({
      attributes: ['postId'],
      where: {
        userId: userId,
        createdAt: {
          [Op.gt]: startCountDate
        }
      }
    })
    return {
      include: [
        {
          model: Post,
          as: 'ancestors',
          required: true,
          where: {
            userId: userId
          }
        }
      ],
      where: {
        id: {
          [Op.notIn]: mentions.push(await getMutedPosts(userId))
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
          [Op.notIn]: (await getBlockedIds(userId)).push(userId)
        }
      }
    }
  }
}
