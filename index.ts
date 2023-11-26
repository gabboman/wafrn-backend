import express, { Response } from 'express'
import { Post, PostMentionsUserRelation, User, sequelize } from './db'
import { Op, Sequelize } from 'sequelize'

import cors from 'cors'
import bodyParser from 'body-parser'
import { authenticateToken } from './utils/authenticateToken'
import getPostBaseQuery from './utils/getPostBaseQuery'

import userRoutes from './routes/users'
import notificationRoutes from './routes/notifications'
import followsRoutes from './routes/follows'
import blockRoutes from './routes/blocks'
import mediaRoutes from './routes/media'
import postsRoutes from './routes/posts'
import searchRoutes from './routes/search'
import getStartScrollParam from './utils/getStartScrollParam'
import deletePost from './routes/deletepost'
import getPosstGroupDetails from './utils/getPostGroupDetails'
import overrideContentType from './utils/overrideContentType'

import { environment } from './environment'
import frontend from './routes/frontend'
import { activityPubRoutes } from './routes/activitypub/activitypub'
import { wellKnownRoutes } from './routes/activitypub/well-known'
import cacheRoutes from './routes/remoteCache'
import likeRoutes from './routes/like'
import AuthorizedRequest from './interfaces/authorizedRequest'
import adminRoutes from './routes/admin'

import swagger from 'swagger-ui-express'
import muteRoutes from './routes/mute'
import blockUserServerRoutes from './routes/blockUserServer'
import optionalAuthentication from './utils/optionalAuthentication'
import { workerInbox, workerUpdateRemoteUsers, workerSendPostChunk, workerPrepareSendPost } from './utils/workers'
import { logger } from './utils/logger'
import listRoutes from './routes/lists'
import getFollowedsIds from './utils/cacheGetters/getFollowedsIds'
import getBlockedIds from './utils/cacheGetters/getBlockedIds'
import getNonFollowedLocalUsersIds from './utils/cacheGetters/getNotFollowedLocalUsersIds'
import { getAllLocalUserIds } from './utils/cacheGetters/getAllLocalUserIds'

const swaggerJSON = require('./swagger.json')

// rest of the code remains same
const app = express()
const PORT = environment.port

app.use(overrideContentType)
app.use(bodyParser.json({ limit: '50mb' }))
app.use(cors())
app.set('trust proxy', 1)

app.use('/api/apidocs', swagger.serve, swagger.setup(swaggerJSON))

app.get('/api/', (req, res) =>
  res.send({
    status: true,
    swagger: 'API docs at /apidocs',
    readme:
      'welcome to the wafrn api, you better check https://github.com/gabboman/wafrn-backend and https://github.com/gabboman/wafrn to figure out where to poke :D. Also, check https://api.wafrn.net/apidocs'
  })
)

// serve static images
app.use('/api/uploads', express.static('uploads'))

app.use('/contexts', express.static('contexts'))

app.get('/api/dashboard', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
  const posterId = req.jwtData?.userId
  const rawPostsByFollowed = await Post.findAll({
    ...getPostBaseQuery(req),
    where: {
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: { [Op.in]: [0, 1, 2] },
      userId: { [Op.in]: await getFollowedsIds(posterId ? posterId : '') }
    }
  })
  const responseWithNotes = await getPosstGroupDetails(rawPostsByFollowed)
  res.send(responseWithNotes)
})

app.get('/api/exploreLocal', optionalAuthentication, async (req: AuthorizedRequest, res) => {
  let rawPosts
  if (req.jwtData) {
    const followedUsers = getFollowedsIds(req.jwtData.userId, true)
    const nonFollowedUsers = getNonFollowedLocalUsersIds(req.jwtData.userId)
    await Promise.all([followedUsers, nonFollowedUsers])
    rawPosts = await Post.findAll({
      ...getPostBaseQuery(req),
      where: {
        createdAt: { [Op.lt]: getStartScrollParam(req) },
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
    })
  } else {
    // its a lot easier if we leave this as another query, the one with the user logged in is complex enough
    const localUsers: string[] = await getAllLocalUserIds()
    rawPosts = await Post.findAll({
      ...getPostBaseQuery(req),
      where: {
        createdAt: { [Op.lt]: getStartScrollParam(req) },
        privacy: { [Op.in]: [0, 2] },
        userId: {
          [Op.in]: localUsers
        }
      }
    })
  }

  const responseWithNotes = await getPosstGroupDetails(rawPosts)
  res.send(responseWithNotes)
})

app.get('/api/explore', authenticateToken, async (req: AuthorizedRequest, res) => {
  const rawPosts = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: {
        [Op.in]: [0, 2]
      },
      content: {
        [Op.notLike]: ''
      }
    },
    ...getPostBaseQuery(req)
  })
  const responseWithNotes = await getPosstGroupDetails(rawPosts)
  res.send(responseWithNotes)
})

app.get('/api/private', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
  const posterId = req.jwtData?.userId
  const mentionedPostIds = (
    await PostMentionsUserRelation.findAll({
      attributes: ['postId'],
      where: {
        userId: posterId
      }
    })
  ).map((mention: any) => mention.postId)
  const rawPostsByFollowed = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: 10,
      [Op.or]: [
        {
          id: {
            [Op.in]: mentionedPostIds
          },
          userId: {
            [Op.notIn]: await getBlockedIds(posterId ? posterId : '')
          }
        },
        {
          userId: posterId
        }
      ]
    },
    ...getPostBaseQuery(req)
  })
  const responseWithNotes = await getPosstGroupDetails(rawPostsByFollowed)
  res.send(responseWithNotes)
})

userRoutes(app)
followsRoutes(app)
blockRoutes(app)
notificationRoutes(app)
mediaRoutes(app)
postsRoutes(app)
searchRoutes(app)
deletePost(app)
activityPubRoutes(app)
wellKnownRoutes(app)
cacheRoutes(app)
likeRoutes(app)
adminRoutes(app)
muteRoutes(app)
blockUserServerRoutes(app)
listRoutes(app)
frontend(app)

app.listen(PORT, environment.listenIp, () => {
  console.log('started app')

  if (environment.workers.mainThread) {
    workerInbox.on('completed', (job) => {
      // console.log(`${job.id} has completed!`)
    })

    workerInbox.on('failed', (job, err) => {
      logger.warn(`${job?.id} has failed with ${err.message}`)
    })

    workerPrepareSendPost.on('completed', (job) => {
      // console.log(`${job.id} has completed!`)
    })

    workerPrepareSendPost.on('failed', (job, err) => {
      console.warn(`sending post ${job?.id} has failed with ${err.message}`)
    })

    workerUpdateRemoteUsers.on('failed', (job, err) => {
      console.warn(`update user ${job?.id} has failed with ${err.message}`)
    })

    workerUpdateRemoteUsers.on('completed', (job) => {
      //console.warn(`user ${job?.id} has been updated`)
    })

    workerSendPostChunk.on('completed', (job) => {
      //console.log(`${job.id} has completed!`)
    })

    workerSendPostChunk.on('failed', (job, err) => {
      console.warn(`sending post to some inboxes ${job?.id} has failed with ${err.message}`)
    })
  } else {
    workerInbox.pause()
    workerPrepareSendPost.pause()
    workerSendPostChunk.pause()
    workerUpdateRemoteUsers.pause()
  }
})
