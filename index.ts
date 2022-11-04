import express from 'express';
import {Post} from './models';
import {Op} from 'sequelize';

const environment = require('./environment');

import cors from 'cors';
import sequelize from './db';
import uploads from './uploads';
import authenticateToken from './utils/authenticateToken';
import getFollowedsIds from './utils/getFollowedsIds';
import getPostBaseQuery from './utils/getPostBaseQuery';

import userRoutes from './routes/users';
import notificationRoutes from './routes/notifications';
import followsRoutes from './routes/follows';
import blockRoutes from './routes/blocks';
import mediaRoutes from './routes/media';
import postsRoutes from './routes/posts';
import searchRoutes from './routes/search';
import getStartScrollParam from './utils/getStartScrollParam';
import deletePost from './routes/deletepost';

const swagger = require('swagger-ui-express');
const swaggerJSON = require('./swagger.json');

// rest of the code remains same
const app = express();
const PORT = process.env.PORT || environment.port;

app.use('/apidocs', swagger.serve, swagger.setup(swaggerJSON));

// TODO: FIX THIS THING FOR THE LOVE OF GOD
// SERIOUSLY WE SHOULD ONLY ACCEPT FILES IN THE APPROPIATE ROUTES
// we should do that HERE and not in the multer as we are doing
// because that thing is growing in complexity like  A LOT
app.use(uploads.any());
app.use(cors());

sequelize
    .sync({
      force: environment.forceSync,
    })
    .then(async () => {
      console.log(`Database & tables ready!`);
      if (environment.forceSync) {
        console.log('CLEANING DATA');
      // seeder();
      }
    });

app.get('/', (req, res) =>
  res.send({
    status: true,
    swagger: 'API docs at /apidocs',
    readme:
      'welcome to the wafrn api, you better check https://github.com/gabboman/wafrn-backend and https://github.com/gabboman/wafrn to figure out where to poke :D. Also, check https://api.wafrn.net/apidocs',
  }),
);

// serve static images
app.use('/uploads', express.static('uploads'));

app.get('/dashboard', authenticateToken, async (req: any, res) => {
  const posterId = req.jwtData.userId;
  const usersFollowed = await getFollowedsIds(posterId);
  const rawPostsByFollowed = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: {[Op.lt]: getStartScrollParam(req)},
      userId: {[Op.in]: usersFollowed},
    },
    ...getPostBaseQuery(req),
  });
  res.send(rawPostsByFollowed);
});

app.get('/explore', async (req: any, res) => {
  const rawPosts = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: {[Op.lt]: getStartScrollParam(req)},
    },
    ...getPostBaseQuery(req),
  });
  res.send(rawPosts);
});

userRoutes(app);
followsRoutes(app);
blockRoutes(app);
notificationRoutes(app);
mediaRoutes(app);
postsRoutes(app);
searchRoutes(app);
deletePost(app);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡️Server is running at https://localhost:${PORT}`);
});
