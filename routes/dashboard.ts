// This file will use the new and improved api that returns more stuff
// it does more queries but it should be more efficient
// the MONSTER QUERY we are using now doesnt scale well on threads with lots of users

import { Application, Response } from 'express'
import { authenticateToken } from '../utils/authenticateToken'
import optionalAuthentication from '../utils/optionalAuthentication'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import {
  Emoji,
  EmojiReaction,
  Media,
  Post,
  PostEmojiRelations,
  PostMediaRelations,
  PostMentionsUserRelation,
  PostTag,
  QuestionPoll,
  QuestionPollAnswer,
  QuestionPollQuestion,
  User,
  UserEmojiRelation,
  UserLikesPostRelations
} from '../db'
import { Op } from 'sequelize'
import getStartScrollParam from '../utils/getStartScrollParam'
import { environment } from '../environment'
import getFollowedsIds from '../utils/cacheGetters/getFollowedsIds'
import getNonFollowedLocalUsersIds from '../utils/cacheGetters/getNotFollowedLocalUsersIds'
import getBlockedIds from '../utils/cacheGetters/getBlockedIds'
import getPosstGroupDetails from '../utils/getPostGroupDetails'

export default function dashboardRoutes(app: Application) {
  app.get('/api/v2/dashboard', optionalAuthentication, async (req: AuthorizedRequest, res: Response) => {
    const level = parseInt(req.query.level as string) // level of dashboard: localExplore, explore, dashboard or DMs
    const posterId = req.jwtData?.userId ? req.jwtData?.userId : 'NOT-LOGGED-IN'
    const POSTS_PER_PAGE = environment.postsPerPage

    // level: 0 explore 1 dashboard 2 localExplore 10 dms
    if (level !== 2 && posterId === 'NOT-LOGGED-IN') {
      res.sendStatus(403)
      return
    }

    let whereObject: any = {
      privacy: 0
    }
    switch (level) {
      case 2: {
        const followedUsers = getFollowedsIds(posterId, true)
        const nonFollowedUsers = getNonFollowedLocalUsersIds(posterId)
        whereObject = {
          [Op.or]: [
            {
              //local follows privacy 0 1 2
              privacy: {
                [Op.in]: [0, 1, 2]
              },
              userId: {
                [Op.in]: await followedUsers
              }
            },
            {
              privacy: {
                [Op.in]: [0, 2]
              },
              userId: {
                [Op.in]: await nonFollowedUsers
              }
            }
          ]
        }
        break
      }
      case 1: {
        whereObject = {
          privacy: { [Op.in]: [0, 1, 2, 3] },
          userId: { [Op.in]: await getFollowedsIds(posterId) }
        }
        break
      }
      case 0: {
        whereObject = {
          privacy: 0
        }
        break
      }
      case 10: {
        // we get the list of posts twice woopsie. Should fix but this way is not going to be "that much"
        const dms = await Post.findAll({
          attributes: ['id'],
          include: [
            {
              model: User,
              as: 'mentionPost',
              where: {
                id: posterId
              },
              attributes: ['id']
            }
          ],
          where: {
            privacy: 10
          }
        })

        whereObject = {
          privacy: 10,
          [Op.or]: [
            {
              id: {
                [Op.in]: dms.map((pst: any) => pst.id) //latestMentionedPosts.map((elem: any) => elem.id)
              },
              userId: {
                [Op.notIn]: await getBlockedIds(posterId)
              }
            },
            {
              userId: posterId
            }
          ]
        }
        break
      }
    }
    // we get the list of posts
    const posts = await Post.findAll({
      order: [['createdAt', 'DESC']],
      limit: POSTS_PER_PAGE,
      include: [
        {
          model: Post,
          as: 'ancestors'
        }
      ],
      where: {
        createdAt: { [Op.lt]: getStartScrollParam(req) },
        ...whereObject
      }
    })

    // we need a list of all the userId we just got from the post
    let userIds: string[] = []
    const postIds: string[] = []
    posts.forEach((post: any) => {
      userIds.push(post.userId)
      postIds.push(post.id)
      post.ancestors?.forEach((ancestor: any) => {
        userIds.push(ancestor.userId)
        postIds.push(ancestor.id)
      })
    })
    const emojis = getEmojis({
      userIds,
      postIds
    })
    const mentions = await getMentionedUserIds(postIds)
    userIds = userIds.concat(mentions.usersMentioned)

    const users = User.findAll({
      attributes: ['url', 'avatar', 'id', 'name', 'remoteId'],
      where: {
        id: {
          [Op.in]: userIds
        }
      }
    })
    const polls = QuestionPoll.findAll({
      where: {
        postId: {
          [Op.in]: postIds
        }
      },
      include: [
        {
          model: QuestionPollQuestion,
          include: [
            {
              model: QuestionPollAnswer,
              required: false,
              where: {
                userId: posterId
              }
            }
          ]
        }
      ]
    })

    const medias = getMedias(postIds)
    const tags = getTags(postIds)
    const likes = getLikes(postIds)
    const postWithNotes = getPosstGroupDetails(posts)
    await Promise.all([emojis, users, polls, medias, tags, likes, postWithNotes])

    res.send({
      posts: await postWithNotes,
      emojiRelations: await emojis,
      mentions: mentions.postMentionRelation,
      users: await users,
      polls: await polls,
      medias: await medias,
      tags: await tags,
      likes: await likes
    })
  })
}

async function getEmojis(input: { userIds: string[]; postIds: string[] }): Promise<{
  userEmojiRelation: any[]
  postEmojiRelation: any[]
  postEmojiReactions: any[]
  emojis: []
}> {
  let postEmojisIds = PostEmojiRelations.findAll({
    attributes: ['emojiId', 'postid'],
    where: {
      postId: {
        [Op.in]: input.postIds
      }
    }
  })

  let postEmojiReactions = EmojiReaction.findAll({
    where: {
      postId: {
        [Op.in]: input.postIds
      }
    }
  })

  let userEmojiId = UserEmojiRelation.findAll({
    attributes: ['emojiId', 'userId'],
    where: {
      userId: {
        [Op.in]: input.userIds
      }
    }
  })

  await Promise.all([postEmojisIds, userEmojiId, postEmojiReactions])
  postEmojisIds = await postEmojisIds
  userEmojiId = await userEmojiId
  postEmojiReactions = await postEmojiReactions

  const emojiIds = []
    .concat(postEmojisIds.map((elem: any) => elem.emojiId))
    .concat(userEmojiId.map((elem: any) => elem.emojiId))
    .concat(postEmojiReactions.map((reaction: any) => reaction.emojiId))
  return {
    userEmojiRelation: await userEmojiId,
    postEmojiRelation: await postEmojisIds,
    postEmojiReactions: await postEmojiReactions,
    emojis: await Emoji.findAll({
      attributes: ['id', 'url', 'external', 'name'],
      where: {
        id: {
          [Op.in]: emojiIds
        }
      }
    })
  }
}

async function getMedias(postIds: string[]) {
  return await Media.findAll({
    attributes: ['id', 'NSFW', 'description', 'url', 'adultContent', 'external'],
    include: [
      {
        model: Post,
        attributes: ['id'],
        where: {
          id: {
            [Op.in]: postIds
          }
        }
      }
    ]
  })
}
async function getMentionedUserIds(
  postIds: string[]
): Promise<{ usersMentioned: string[]; postMentionRelation: any[] }> {
  const mentions = await PostMentionsUserRelation.findAll({
    attributes: ['userId', 'postId'],
    where: {
      postId: {
        [Op.in]: postIds
      }
    }
  })
  const usersMentioned = mentions.map((elem: any) => elem.userId)
  const postMentionRelation = mentions.map((elem: any) => {
    return { userMentioned: elem.userId, post: elem.postId }
  })
  return { usersMentioned, postMentionRelation }
}

async function getTags(postIds: string[]) {
  return await PostTag.findAll({
    attributes: ['postId', 'tagName'],
    where: {
      postId: {
        [Op.in]: postIds
      }
    }
  })
}

async function getLikes(postIds: string[]) {
  return await UserLikesPostRelations.findAll({
    attributes: ['userId', 'postId'],
    where: {
      postId: {
        [Op.in]: postIds
      }
    }
  })
}
