import {Application} from 'express';
import {Op} from 'sequelize';
import {Tag, User} from '../models';
import getPostBaseQuery from '../utils/getPostBaseQuery';

export default function searchRoutes(app: Application) {
  app.post('/search', async (req, res) => {
    // const success = false;
    let users: any = [];
    let posts: any = [];
    const promises: Promise<any>[] = [];
    if (req.body && req.body.term) {
      const searchTerm = req.body.term.toLowerCase().trim();
      // we get the tag if exists then get posts from the tag
      // same way ass dashboard
      const tagSearch = await Tag.findOne({
        where: {
          tagName: searchTerm,
        },
      });
      if (tagSearch) {
        posts = tagSearch.getPosts({
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
        promises.push(posts);
      }
      users = User.findAll({
        limit: 20,
        offset: req.body?.page ? req.body.page * 20 : 0,
        where: {
          activated: true,
          [Op.or]: [
            sequelize.where(
                sequelize.fn('LOWER', sequelize.col('url')),
                'LIKE',
                '%' + searchTerm + '%',
            ),
            sequelize.where(
                sequelize.fn('LOWER', sequelize.col('description')),
                'LIKE',
                '%' + searchTerm + '%',
            ),
          ],
        },
        attributes: {
          exclude: [
            'password',
            'birthDate',
            'email',
            'lastLoginIp',
            'registerIp',
            'activated',
            'activationCode',
            'requestedPasswordReset',
            'updatedAt',
            'createdAt',
            'lastTimeNotificationsCheck',
          ],
        },
      });
      promises.push(users);
    }
    await Promise.all(promises);
    res.send({
      users: await users,
      posts: await posts,
    });
  });

  app.get('/userSearch/:term', async (req, res) => {
    // const success = false;
    let users: any = [];
    const searchTerm = req.params.term.toLowerCase().trim();
    users = User.findAll({
      limit: 5,
      where: {
        activated: true,
        [Op.or]: [
          sequelize.where(
              sequelize.fn('LOWER', sequelize.col('url')),
              'LIKE',
              '%' + searchTerm + '%',
          ),
        ],
      },
      attributes: ['url', 'avatar', 'id'],
    });

    res.send({
      users: await users,
    });
  });
}
