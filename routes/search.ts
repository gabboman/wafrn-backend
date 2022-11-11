import { Application } from 'express'
import { Op } from 'sequelize'
import { Tag, User } from '../models'
import getPostBaseQuery from '../utils/getPostBaseQuery'
import sequelize from '../db'
import getStartScrollParam from '../utils/getStartScrollParam'
import getPosstGroupDetails from '../utils/getPostGroupDetails'

export default function searchRoutes (app: Application) {
  app.get('/search/', async (req, res) => {
    // const success = false;
    // eslint-disable-next-line max-len
    const searchTerm: string = (req.query.term || '').toString().toLowerCase().trim()

    let users: any = []
    let posts: any = []
    let responseWithNotes: any = []
    const promises: Array<Promise<any>> = []

    if (searchTerm) {
      // we get the tag if exists then get posts from the tag
      // same way ass dashboard
      const tagSearch = await Tag.findOne({
        where: {
          tagName: searchTerm
        }
      })

      if (tagSearch) {
        posts = tagSearch.getPosts({
          where: {
            // date the user has started scrolling
            createdAt: { [Op.lt]: getStartScrollParam(req) }
          },
          ...getPostBaseQuery(req)
        })
        responseWithNotes = getPosstGroupDetails(await posts)
        promises.push(responseWithNotes)
      }

      users = User.findAll({
        limit: 20,
        offset: (Number(req.query.page || 0)) * 20,
        where: {
          activated: true,
          [Op.or]: [
            sequelize.where(
              sequelize.fn('LOWER', sequelize.col('url')),
              'LIKE',
              '%' + searchTerm + '%'
            ),
            sequelize.where(
              sequelize.fn('LOWER', sequelize.col('description')),
              'LIKE',
              '%' + searchTerm + '%'
            )
          ]
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
            'lastTimeNotificationsCheck'
          ]
        }
      })
      promises.push(users)
    }
    await Promise.all(promises)
    res.send({
      users: await users,
      posts: await responseWithNotes
    })
  })

  app.get('/userSearch/:term', async (req, res) => {
    // const success = false;
    let users: any = []
    const searchTerm = req.params.term.toLowerCase().trim()
    users = User.findAll({
      limit: 5,
      where: {
        activated: true,
        [Op.or]: [
          sequelize.where(
            sequelize.fn('LOWER', sequelize.col('url')),
            'LIKE',
            '%' + searchTerm + '%'
          )
        ]
      },
      attributes: ['url', 'avatar', 'id']
    })

    res.send({
      users: await users
    })
  })
}
