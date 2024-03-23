import express, { Response } from 'express'
import { Post, PostMentionsUserRelation, User, sequelize } from './db'
import { Op, Sequelize } from 'sequelize'

import cors from 'cors'
import bodyParser from 'body-parser'
import { authenticateToken } from './utils/authenticateToken'

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
import { IncomingMessage } from 'http'
import statusRoutes from './routes/status'
import dashboardRoutes from './routes/dashboard'
import forumRoutes from './routes/forum'

const swaggerJSON = require('./swagger.json')
// rest of the code remains same
const app = express()
const PORT = environment.port

app.use(overrideContentType)
app.use(
  bodyParser.json({
    limit: '50mb',
    verify: (req: IncomingMessage, res, buf) => {
      req.rawBody = buf
    }
  })
)
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
dashboardRoutes(app)
listRoutes(app)
frontend(app)
forumRoutes(app)
statusRoutes(app)

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
