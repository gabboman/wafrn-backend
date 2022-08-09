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

// rest of the code remains same
const app = express();
const PORT = environment.port;

// TODO fix this!
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
    readme:
      'welcome to the wafrn api, you better check https://github.com/gabboman/wafrn to figure out where to poke :D',
  }),
);

// serve static images
app.use('/uploads', express.static('uploads'));

app.post('/dashboard', authenticateToken, async (req: any, res) => {
  const posterId = req.jwtData.userId;
  const usersFollowed = await getFollowedsIds(posterId);
  const rawPostsByFollowed = await Post.findAll({
    where: {
      userId: {[Op.in]: usersFollowed},
      // date the user has started scrolling
      createdAt: {
        [Op.lt]: req.body?.startScroll ?
          new Date().setTime(req.body.startScroll) :
          new Date(),
      },
    },
    ...getPostBaseQuery(req),
  });
  res.send(rawPostsByFollowed);
});

app.post('/explore', async (req: any, res) => {
  const rawPosts = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: {
        [Op.lt]: req.body?.startScroll ?
          new Date().setTime(req.body.startScroll) :
          new Date(),
      },
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});
