import { Application } from 'express'
import { Op } from 'sequelize'
import { Tag, User } from '../db'
import getPostBaseQuery from '../utils/getPostBaseQuery'
import { sequelize } from '../db'

import getStartScrollParam from '../utils/getStartScrollParam'
import getPosstGroupDetails from '../utils/getPostGroupDetails'
import axios from 'axios'
import { getRemoteActor, searchRemoteUser } from './activitypub'
import optionalAuthentication from '../utils/optionalAuthentication'
import authenticateToken from '../utils/authenticateToken';


export default function searchRoutes (app: Application) {
  app.get('/search/', optionalAuthentication, async (req: any, res) => {
    const posterId = req.jwtData.userId
    // const success = false;
    // eslint-disable-next-line max-len
    const searchTerm: string = (req.query.term || '').toString().toLowerCase().trim()

    let users: any = []
    let posts: any = []
    let remoteUsers: any[] = []
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
              `%${searchTerm}%`
            ),
            sequelize.where(
              sequelize.fn('LOWER', sequelize.col('description')),
              'LIKE',
              `%${searchTerm}%`
            )
          ]
        },
        attributes: [
            'id',
            'url',
            'description',
            'avatar',
            'remoteId'
        ]
      })
      promises.push(users)
      // remote user search time
      if (posterId) {
        remoteUsers = await searchRemoteUser(searchTerm, await User.findOne({where: {id: posterId}}))
      }
    }
    await Promise.all(promises)
    res.send({
      users: (await users).concat(remoteUsers),
      posts: await responseWithNotes
    })
  })

  app.get('/userSearch/:term', authenticateToken ,async (req: any, res) => {
    const posterId = req.jwtData.userId
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
            `%${searchTerm}%`
          )
        ]
      },
      attributes: ['url', 'avatar', 'id', 'remoteId']
    })

    res.send({
      users: (await users).concat(await searchRemoteUser(searchTerm, await User.findOne({where: {id: posterId}})))
    })
  })
}
