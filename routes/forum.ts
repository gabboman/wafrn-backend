import optionalAuthentication from '../utils/optionalAuthentication'
import checkIpBlocked from '../utils/checkIpBlocked'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { Application, Request, Response } from 'express'
import { Post, QuestionPoll, QuestionPollAnswer, QuestionPollQuestion, User, sequelize } from '../db'
import { Op } from 'sequelize'
import {
  getEmojis,
  getLikes,
  getMedias,
  getMentionedUserIds,
  getQuotes,
  getTags,
  getUnjointedPosts
} from '../utils/baseQueryNew'
import getFollowedsIds from '../utils/cacheGetters/getFollowedsIds'

export default function forumRoutes(app: Application) {
  app.get('/api/forum/:id', optionalAuthentication, checkIpBlocked, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId ? req.jwtData.userId : 'NOT-LOGGED-IN'
    const postId = req.params?.id as string
    const postsToGet = await Post.findOne({
      where: {
        id: postId
      },
      attributes: ['id', 'hierarchyLevel']
    })
    if (postsToGet) {
      if (postsToGet.hierarchyLevel === 1) {
        const fullPostsToGet = await Post.findAll({
          where: {
            [Op.or]: [
              {
                id: postId
              },
              //IN THEORY this would be REAAAAAAALLY dangerous. but this is inside of an if. good luck with a post that is a scape stuff
              sequelize.literal(`id IN (SELECT DISTINCT postsId FROM postsancestors where ancestorId = "${postId}")`)
            ],
            privacy: {
              [Op.ne]: 10
            },
            [Op.and]: [
              {
                [Op.or]: [
                  {
                    userId: userId
                  },
                  {
                    privacy: 1,
                    userId: {
                      [Op.in]: await getFollowedsIds(userId, false)
                    }
                  },
                  {
                    privacy: {
                      [Op.in]: [0, 2]
                    }
                  }
                ]
              }
            ]
          }
        })
        let postIds = fullPostsToGet.map((elem: any) => elem.id)
        const quotes = await getQuotes(postIds)
        const quotedPostsIds = quotes.map((quote) => quote.quotedPostId)
        postIds = postIds.concat(quotedPostsIds)
        const quotedPosts = await Post.findAll({
          where: {
            id: {
              [Op.in]: quotedPostsIds
            }
          }
        })
        let userIds = fullPostsToGet.map((pst: any) => userId)
        userIds = userIds.concat(quotedPosts.map((q: any) => q.userId))
        const emojis = getEmojis({
          userIds,
          postIds
        })
        const mentions = await getMentionedUserIds(postIds)
        userIds = userIds.concat(mentions.usersMentioned)
        userIds = userIds.concat((await emojis).postEmojiReactions.map((react: any) => react.userId))
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
                    userId: userId
                  }
                }
              ]
            }
          ]
        })
        const medias = getMedias(postIds)
        const tags = getTags(postIds)
        const likes = await getLikes(postIds)
        userIds = userIds.concat(likes.map((like: any) => like.userId))
        const users = User.findAll({
          attributes: ['url', 'avatar', 'id', 'name', 'remoteId'],
          where: {
            id: {
              [Op.in]: userIds
            }
          }
        })
        await Promise.all([emojis, users, polls, medias, tags])

        res.send({
          posts: await fullPostsToGet,
          emojiRelations: await emojis,
          mentions: mentions.postMentionRelation,
          users: await users,
          polls: await polls,
          medias: await medias,
          tags: await tags,
          likes: likes,
          quotes: quotes,
          quotedPosts: await quotedPosts
        })
        //res.send(await getUnjointedPosts(postIds, userId))
      } else {
        const parent = await postsToGet.getAncestors({
          where: {
            hierarchyLevel: 1
          }
        })
        res.redirect('/api/forum/' + parent[0].id)
      }
    } else {
      res.sendStatus(404)
    }
  })
}
