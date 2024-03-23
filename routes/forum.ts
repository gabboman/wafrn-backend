import optionalAuthentication from '../utils/optionalAuthentication'
import checkIpBlocked from '../utils/checkIpBlocked'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { Application, Request, Response } from 'express'
import { Post } from '../db'
import { Op } from 'sequelize'
import { getUnjointedPosts } from '../utils/baseQueryNew'
import getFollowedsIds from '../utils/cacheGetters/getFollowedsIds'

export default function forumRoutes(app: Application) {
  app.get('/api/forum/:id', optionalAuthentication, checkIpBlocked, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId ? req.jwtData.userId : 'NOT-LOGGED-IN'
    const postId = req.params?.id as string
    const postsToGet = await Post.findOne({
      where: {
        id: postId
      },
      attributes: ['id', 'hierarchyLevel'],
      include: [
        {
          model: Post,
          attributes: ['id'],
          as: 'descendents',
          required: false,
          where: {
            privacy: {
              [Op.ne]: 10
            },
            [Op.or]: [
              {
                userId: userId
              },
              {
                privacy: 1,
                userId: {
                  [Op.in]: await getFollowedsIds(userId, false)
                }
              },
              {
                privacy: 0
              }
            ]
          }
        }
      ]
    })
    if (postsToGet) {
      if (postsToGet.hierarchyLevel === 1) {
        const postIds = postsToGet.descendents.map((elem: any) => elem.id)
        res.send(await getUnjointedPosts(postIds, userId))
      } else {
        const parent = await postsToGet.getAncestors({
          where: {
            hierarchyLevel: 1
          }
        })
        res.redirect('/api/forum/' + parent[0].id)
      }
    } else {
      res.sendStatus(404)
    }
  })
}
