import express from 'express'
import { Post, User, sequelize } from './db'
import { Op } from 'sequelize'

import cors from 'cors'
import bodyParser from 'body-parser'
import authenticateToken from './utils/authenticateToken'
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
import { activityPubRoutes } from './routes/activitypub'
import overrideContentType from './utils/overrideContentType'

import { environment } from './environment'
import { logger } from './utils/logger'

const swagger = require('swagger-ui-express')
const swaggerJSON = require('./swagger.json')

// rest of the code remains same
const app = express()
const PORT = environment.port

app.use(overrideContentType)
app.use(bodyParser.json())
app.use(cors())

//const pino = require('pino-http')()
//app.use(pino)

app.use('/apidocs', swagger.serve, swagger.setup(swaggerJSON))

app.get('/', (req, res) =>
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

app.get('/dashboard', authenticateToken, async (req: any, res) => {
  const posterId = req.jwtData.userId
  const rawPostsByFollowed = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      literal: sequelize.literal(`userId in
        (select followerId from follows where followedId like "${posterId}") OR userId like "${posterId}" `
      ),
      privacy: {[Op.in]: [0, 1] }
    },
    ...getPostBaseQuery(req)
  })
  const responseWithNotes = await getPosstGroupDetails(rawPostsByFollowed)
  res.send(responseWithNotes)
})

app.get('/exploreLocal', async (req: any, res) => {
  const rawPosts = await Post.findAll({
    ...getPostBaseQuery(req),
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      //userId: { [Op.in]: localUsers.map((user: any) => user.id) },
      privacy: 0,
      literal:  sequelize.literal(`userId in (select id from users where url not like '@%')`)
    },
  })
  const responseWithNotes = await getPosstGroupDetails(rawPosts)
  res.send(responseWithNotes)
})

app.get('/explore', async (req: any, res) => {
  const rawPosts = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: 0,
    },
    ...getPostBaseQuery(req)
  })
  const responseWithNotes = await getPosstGroupDetails(rawPosts)
  res.send(responseWithNotes)
})


app.get('/private',authenticateToken, async (req: any, res) => {
  const posterId = req.jwtData.userId
  const rawPostsByFollowed = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: { [Op.lt]: getStartScrollParam(req) },
      privacy: 10,
      literal: sequelize.literal(`id in (select postId from postMentionsUserRelations where userId like "${posterId}") or userId like "${posterId}" and privacy=10`
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

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`⚡️Server is running at https://localhost:${PORT}`)
})
