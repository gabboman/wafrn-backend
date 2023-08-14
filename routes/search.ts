import { Application, Response } from 'express'
import { Op, Sequelize } from 'sequelize'
import { Post, PostTag, User } from '../db'
import getPostBaseQuery from '../utils/getPostBaseQuery'
import { sequelize } from '../db'

import getStartScrollParam from '../utils/getStartScrollParam'
import getPosstGroupDetails from '../utils/getPostGroupDetails'
import optionalAuthentication from '../utils/optionalAuthentication'
import { authenticateToken } from '../utils/authenticateToken'

import { searchRemoteUser } from '../utils/activitypub/searchRemoteUser'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { environment } from '../environment'

export default function searchRoutes(app: Application) {
  app.get('/api/search/', optionalAuthentication, async (req: AuthorizedRequest, res: Response) => {
    const posterId = req.jwtData?.userId
    // const success = false;
    // eslint-disable-next-line max-len
    const searchTerm: string = (req.query.term || '').toString().toLowerCase().trim()

    let users: any = []
    let posts: any = []
    let remoteUsers: any[] = []
    let responseWithNotes: any = []
    const promises: Array<Promise<any>> = []

    if (searchTerm) {

      const page = Number(req?.query.page) || 0
      const postIds = await PostTag.findAll({
        where: {
          tagName: {
            [Op.like]: `%${searchTerm}%`
          }
        },
        attributes: [
          'postId'
        ],
        order: [['createdAt', 'DESC']],
        limit: environment.postsPerPage,
        offset: page * environment.postsPerPage
      });
        posts = Post.findAll({
          where: {
            // date the user has started scrolling
            createdAt: { [Op.lt]: getStartScrollParam(req) },
            id: {
              [Op.in]: postIds.map((elem: any) => elem.postId)
            },
            privacy: {
              [Op.in]: [0,2]
            }
          },
          ...getPostBaseQuery(req)
        })
        responseWithNotes = getPosstGroupDetails(await posts)
        promises.push(responseWithNotes)

      users = User.findAll({
        limit: 20,
        offset: Number(req.query.page || 0) * 20,
        where: {
          activated: true,
          federatedHostId: {
            [Op.in]: Sequelize.literal(`(SELECT id FROM federatedHosts WHERE blocked= false)`)
          },
          banned: false,
          [Op.or]: [
            sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', `%${searchTerm}%`),
            sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), 'LIKE', `%${searchTerm}%`)
          ]
        },
        attributes: ['id', 'url', 'description', 'avatar', 'remoteId']
      })
      promises.push(users)
      // remote user search time
      if (posterId) {
        remoteUsers = await searchRemoteUser(searchTerm, await User.findOne({ where: { id: posterId } }))
      }
    }
    await Promise.all(promises)
    res.send({
      users: (await users).concat(remoteUsers),
      posts: await responseWithNotes
    })
  })

  app.get('/api/userSearch/:term', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const posterId = req.jwtData?.userId
    // const success = false;
    let users: any = []
    const searchTerm = req.params.term.toLowerCase().trim()
    users = await User.findAll({
      limit: 20,
      where: {
        activated: true,
        url: { [Op.like]: '@%' },
        federatedHostId: {
          [Op.in]: Sequelize.literal(`(SELECT id FROM federatedHosts WHERE blocked= false)`)
        },
        banned: false,
        [Op.or]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', `%${searchTerm}%`)]
      },
      attributes: ['url', 'avatar', 'id', 'remoteId']
    })

    const localUsers = await User.findAll({
      limit: 20,
      where: {
        activated: true,
        url: { [Op.notLike]: '@%' },
        [Op.or]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', `%${searchTerm}%`)]
      },
      attributes: ['url', 'avatar', 'id', 'remoteId']
    })
    const result = localUsers
      .concat(users)
      .concat(await searchRemoteUser(searchTerm, await User.findOne({ where: { id: posterId } })))
    res.send({
      users: result
    })
  })
}
