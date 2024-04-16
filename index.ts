import express, { Response } from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import userRoutes from './routes/users'
import notificationRoutes from './routes/notifications'
import followsRoutes from './routes/follows'
import blockRoutes from './routes/blocks'
import mediaRoutes from './routes/media'
import postsRoutes from './routes/posts'
import searchRoutes from './routes/search'
import deletePost from './routes/deletePost'
import overrideContentType from './utils/overrideContentType'
import { environment } from './environment'
import frontend from './routes/frontend'
import { activityPubRoutes } from './routes/activitypub/activitypub'
import { wellKnownRoutes } from './routes/activitypub/well-known'
import cacheRoutes from './routes/remoteCache'
import likeRoutes from './routes/like'
import adminRoutes from './routes/admin'
import swagger from 'swagger-ui-express'
import muteRoutes from './routes/mute'
import blockUserServerRoutes from './routes/blockUserServer'
import { workerInbox, workerUpdateRemoteUsers, workerSendPostChunk, workerPrepareSendPost } from './utils/workers'
import { logger } from './utils/logger'
import listRoutes from './routes/lists'
import statusRoutes from './routes/status'
import dashboardRoutes from './routes/dashboard'
import forumRoutes from './routes/forum'
import { SignedRequest } from './interfaces/fediverse/signedRequest'
import silencePostRoutes from './routes/silencePost'

const swaggerJSON = require('./swagger.json')
// rest of the code remains same
const app = express()
const PORT = environment.port

app.use(overrideContentType)
app.use(
  bodyParser.json({
    limit: '50mb',
    verify: (req: SignedRequest, res, buf) => {
      req.rawBody = buf.toString()
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
silencePostRoutes(app)
statusRoutes(app)

app.listen(PORT, environment.listenIp, () => {
  console.log('started app')

  if (environment.workers.mainThread) {
    workerInbox.on('completed', (job) => {})

    workerInbox.on('failed', (job, err) => {
      logger.warn(`${job?.id} has failed with ${err.message}`)
    })

    workerPrepareSendPost.on('completed', (job) => {})

    workerPrepareSendPost.on('failed', (job, err) => {
      console.warn(`sending post ${job?.id} has failed with ${err.message}`)
    })

    workerUpdateRemoteUsers.on('failed', (job, err) => {
      console.warn(`update user ${job?.id} has failed with ${err.message}`)
    })

    workerUpdateRemoteUsers.on('completed', (job) => {})

    workerSendPostChunk.on('completed', (job) => {})

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
