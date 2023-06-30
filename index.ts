import express, {Response} from 'express'
import { Post, sequelize } from './db'
import { Op } from 'sequelize'

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
import { logger } from './utils/logger'
import frontend from './routes/frontend'
import { activityPubRoutes } from './routes/activitypub/activitypub'
import { wellKnownRoutes } from './routes/activitypub/well-known'
import cacheRoutes from './routes/remoteCache'
import likeRoutes from './routes/like'
import { workerInbox, workerUpdateRemoteUsers, workerSendPostChunk, workerPrepareSendPost } from './utils/workers'
import AuthorizedRequest from './interfaces/authorizedRequest'

const swagger = require('swagger-ui-express')
const swaggerJSON = require('./swagger.json')

// rest of the code remains same
const app = express()
const PORT = environment.port

app.use(overrideContentType)
app.use(bodyParser.json())
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
app.use('/uploads', express.static('uploads'))

app.use('/contexts', express.static('contexts'))

app.get('/api/dashboard', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
  const posterId = req.jwtData?.userId
  const rawPostsByFollowed = await Post.findAll({
    ...getPostBaseQuery(req),
    where: {
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: { [Op.in]: [0, 1] },
      literal: sequelize.literal(
        `userId in (select followedId from follows where followerId like "${posterId}") OR userId like "${posterId}"`
      )
    }
  })
  const responseWithNotes = await getPosstGroupDetails(rawPostsByFollowed)
  res.send(responseWithNotes)
})

app.get('/api/exploreLocal', async (req: any, res) => {
  const rawPosts = await Post.findAll({
    ...getPostBaseQuery(req),
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: { [Op.in]: [0, 2] },
      literal: sequelize.literal(`userId in (select id from users where url not like "@%")`)
    }
  })
  const responseWithNotes = await getPosstGroupDetails(rawPosts)
  res.send(responseWithNotes)
})

app.get('/api/explore', async (req: any, res) => {
  const rawPosts = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: 0
    },
    ...getPostBaseQuery(req)
  })
  const responseWithNotes = await getPosstGroupDetails(rawPosts)
  res.send(responseWithNotes)
})

app.get('/api/private', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
  const posterId = req.jwtData?.userId
  const rawPostsByFollowed = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: 10,
      literal: sequelize.literal(
        `id in (select postId from postMentionsUserRelations where userId like "${posterId}") or userId like "${posterId}" and privacy=10`
      )
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
frontend(app)

app.listen(PORT, environment.listenIp, () => {
  console.log('started app')
  workerInbox.on('completed', (job) => {
    // console.log(`${job.id} has completed!`)
  })

  workerInbox.on('failed', (job, err) => {
    console.warn(`${job?.id} has failed with ${err.message}`)
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
})
