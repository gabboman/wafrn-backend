import { Application, Request, Response } from 'express'
import { Op, Sequelize } from 'sequelize'
import {
  Blocks,
  Post,
  PostMentionsUserRelation,
  PostReport,
  ServerBlock,
  PostTag,
  User,
  Follows,
  UserLikesPostRelations,
  Media
} from '../db'
import { authenticateToken } from '../utils/authenticateToken'

import getPostBaseQuery from '../utils/getPostBaseQuery'
import { sequelize } from '../db'

import getStartScrollParam from '../utils/getStartScrollParam'
import getPosstGroupDetails from '../utils/getPostGroupDetails'
import { logger } from '../utils/logger'
import { createPostLimiter } from '../utils/rateLimiters'
import { environment } from '../environment'
import { Queue } from 'bullmq'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import optionalAuthentication from '../utils/optionalAuthentication'
import { getPetitionSigned } from '../utils/activitypub/getPetitionSigned'
import { getPostThreadRecursive } from '../utils/activitypub/getPostThreadRecursive'

const prepareSendPostQueue = new Queue('prepareSendPost', {
  connection: environment.bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnFail: 25000
  }
})
export default function postsRoutes(app: Application) {
  app.get('/api/singlePost/:id', async (req: Request, res: Response) => {
    let success = false
    if (req.params?.id) {
      const query: any = getPostBaseQuery(req)
      query.include.push({
        model: Post,
        as: 'descendents',
        required: false,
        order: [['createdAt']],
        where: {
          privacy: {
            [Op.in]: [0, 2]
          }
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['avatar', 'url', 'description', 'id']
          },
          {
            model: UserLikesPostRelations,
            attributes: ['userId'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['avatar', 'url', 'description', 'id']
              }
            ]
          },
          {
            model: PostTag,
            attributes: ['tagName']
          }
        ]
      })
      const post = await Post.findOne({
        ...query,
        where: {
          id: req.params.id,
          privacy: { [Op.ne]: 10 }
        }
      })
      if (post) {
        const postResponse = (await getPosstGroupDetails([post]))[0]
        res.send(postResponse)
        success = true
      }
    }

    if (!success) {
      res.send({ success: false })
    }
  })

  app.get('/api/blog', optionalAuthentication, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    const id = req.query.id

    if (id) {
      const blog = await User.findOne({
        where: {
          url: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', (id as string).toLowerCase())
        }
      })
      const blogId = blog?.id
      if (blogId) {
        const privacyArray = [0, 2]
        if (
          req.jwtData?.userId === blogId ||
          (req.jwtData?.userId &&
            (await Follows.findOne({
              where: {
                followedId: blogId,
                followerId: req.jwtData?.userId,
                accepted: true
              }
            })))
        ) {
          privacyArray.push(1)
        }
        const postsByBlog = await Post.findAll({
          where: {
            userId: blogId,
            // date the user has started scrolling
            createdAt: { [Op.lt]: getStartScrollParam(req) },
            privacy: {
              [Op.in]: privacyArray
            }
          },
          ...getPostBaseQuery(req)
        })
        success = true
        res.send(await getPosstGroupDetails(postsByBlog))
      }
    }

    if (!success) {
      res.send({ success: false })
    }
  })

  app.post('/api/createPost', authenticateToken, createPostLimiter, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    const posterId = req.jwtData?.userId
    try {
      if (req.body.parent) {
        const parent = await Post.findOne({
          where: {
            id: req.body.parent
          },
          include: [
            {
              model: Post,
              as: 'ancestors'
            }
          ]
        })
        if (!parent) {
          success = false
          res.status(500)
          res.send({ success: false, message: 'non existent parent' })
          return false
        }
        // we check that the user is not reblogging a post by someone who blocked them or the other way arround
        // TODO: make poostparentusers an unique array.
        const postParentsUsers: string[] = parent.ancestors.map((elem: any) => elem.userId)
        postParentsUsers.push(parent.userId)
        const bannedUsers = await User.count({
          where: {
            id: {
              [Op.in]: postParentsUsers
            },
            banned: true
          }
        })
        const blocksExistingOnParents = await Blocks.count({
          where: {
            [Op.or]: [
              {
                blockerId: posterId,
                blockedId: { [Op.in]: postParentsUsers }
              },
              {
                blockedId: posterId,
                blockerId: { [Op.in]: postParentsUsers }
              }
            ]
          }
        })
        if (blocksExistingOnParents + bannedUsers > 0) {
          success = false
          res.status(500)
          res.send({ success: false, message: 'You have no permission to reblog this post' })
          return false
        }
      }
      const content = req.body.content ? req.body.content.trim() : ''
      const content_warning = req.body.content_warning ? req.body.content_warning.trim() : ''
      const post = await Post.create({
        content,
        content_warning,
        userId: posterId,
        privacy: req.body.privacy ? req.body.privacy : 0,
        parentId: req.body.parent
      })

      // detect media in posts using regexes

      // eslint-disable-next-line max-len
      const wafrnMediaRegex =
        /\[wafrnmediaid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm

      // eslint-disable-next-line max-len
      const mentionRegex =
        /\[mentionuserid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm

      // eslint-disable-next-line max-len
      const uuidRegex = /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/

      const mediaInPost = req.body.content.match(wafrnMediaRegex)
      const mentionsInPost = req.body.content.match(mentionRegex)
      if (mediaInPost) {
        const mediaToAdd: string[] = []
        mediaInPost.forEach((element: string) => {
          const mediaUUIDs = element.match(uuidRegex)
          if (mediaUUIDs != null) {
            const uuid = mediaUUIDs[0]
            if (!mediaToAdd.includes(uuid)) {
              mediaToAdd.push(uuid)
            }
          }
        })

        post.addMedias(mediaToAdd)
      }

      if (mentionsInPost) {
        const mentionsToAdd: string[] = []
        mentionsInPost.forEach((elem: string) => {
          const mentionedUserUUID = elem.match(uuidRegex)

          if (
            mentionedUserUUID != null &&
            mentionedUserUUID[0] !== null &&
            !mentionsToAdd.includes(mentionedUserUUID[0])
          ) {
            mentionsToAdd.push(mentionedUserUUID[0])
          }
        })
        const blocksExisting = await Blocks.count({
          where: {
            [Op.or]: [
              {
                blockerId: posterId,
                blockedId: { [Op.in]: mentionsToAdd }
              },
              {
                blockedId: posterId,
                blockerId: { [Op.in]: mentionsToAdd }
              }
            ]
          }
        })
        const blocksServers = await ServerBlock.count({
          where: {
            userBlockerId: posterId,
            literal: Sequelize.literal(
              `blockedServerId IN (SELECT federatedHostId from users where id IN (${mentionsToAdd.map(
                (elem) => '"' + elem + '"'
              )}))`
            )
          }
        })
        if (blocksExisting + blocksServers > 0) {
          res.status(500)
          post.destroy()
          res.send({
            error: true,
            message: 'You can not mention an user that you have blocked or has blocked you'
          })
          return null
        }
        mentionsToAdd.forEach((mention) => {
          PostMentionsUserRelation.create({
            userId: mention,
            postId: post.id
          })
        })
      }
      success = !req.body.tags
      if (req.body.tags) {
        const tagListString = req.body.tags
        let tagList: string[] = tagListString.split(',')
        tagList = tagList.map((s: string) => s.trim())
        await PostTag.bulkCreate(
          tagList.map((tag) => {
            return {
              tagName: tag,
              postId: post.id
            }
          })
        )

        success = true
      }
      res.send(post)
      await post.save()
      if (post.privacy.toString() !== '2') {
        await prepareSendPostQueue.add('prepareSendPost', { postId: post.id, petitionBy: posterId }, { jobId: post.id })
      }
    } catch (error) {
      logger.error(error)
    }
    if (!success) {
      res.statusCode = 400
      res.send({ success: false })
    }
  })

  app.post('/api/reportPost', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    let success = false
    let report
    try {
      const posterId = req.jwtData?.userId
      if (req.body?.postId && req.body.severity && req.body.description) {
        report = await PostReport.create({
          resolved: false,
          severity: req.body.severity,
          description: req.body.description,
          userId: posterId,
          postId: req.body.postId
        })
        success = true
        res.send(report)
      }
    } catch (error) {
      logger.error(error)
    }
    if (!success) {
      res.send({
        success: false
      })
    }
  })

  app.get('/api/loadRemoteResponses', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    try {
      const userId = req.jwtData?.userId;
      const postToGetRepliesFromId = req.query.id;
      let remotePost = Post.findByPk(postToGetRepliesFromId)
      let user = User.findByPk(userId);
      await Promise.all([user, remotePost])
      user = await user;
      remotePost = await remotePost;
      const postPetition = await getPetitionSigned(user, remotePost.remotePostId);
      if(postPetition) {
        if(postPetition.inReplyTo && remotePost.hierarchyLevel === 1) {
          const lostParent = await getPostThreadRecursive(user, postPetition.inReplyTo)
          await remotePost.setParent(lostParent)
          console.log(lostParent)
        }
        // next replies to process
        let next = postPetition.replies.first
        while(next) {
          const petitions = next.items.map((elem: string) => getPostThreadRecursive(user, elem));
          await Promise.allSettled(petitions);
          next =next.next ?  await getPetitionSigned(user, next.next) : undefined
        }
      }
    } catch (error) {
      logger.debug({message: 'error getting external responses', error: error})
    }
    res.send({});

  })
}
