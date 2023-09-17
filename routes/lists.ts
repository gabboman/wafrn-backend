import { Application, Response } from 'express'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { authenticateToken } from '../utils/authenticateToken'
import uploadHandler from '../utils/uploads'
import fs from 'fs/promises'
import parse from 'csv-parse'
import { environment } from '../environment'
import { Follows, User, sequelize } from '../db'
import { Op } from 'sequelize'
import { searchRemoteUser } from '../utils/activitypub/searchRemoteUser'
import { follow } from '../utils/follow'
export default function listRoutes(app: Application) {
  // Recomended users to follow
  app.post(
    '/api/loadFollowList',
    authenticateToken,
    uploadHandler(/\.(csv)$/).single('follows'),
    async (req: AuthorizedRequest, res: Response) => {
      if (req.file) {
        try {
          const petitionBy = await User.findByPk(req.jwtData?.userId)
          const lines: string[] = (await fs.readFile(req.file.path, 'utf8'))
            .split('\n')
            .map((elem) => elem.split(',')[0])
            .slice(1)
          const okUsers: string[] = []
          let localUsers = lines
            .filter((elem) => elem.endsWith('@' + environment.instanceUrl))
            .map((elem) => elem.split('@')[0].toLowerCase())
            .map((elem) =>
              User.findOne({
                where: {
                  [Op.and]: [
                    sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', elem),
                    {
                      banned: false
                    }
                  ]
                }
              })
            )
          const remoteUsersPromises = lines
            .filter((elem) => !elem.endsWith('@' + environment.instanceUrl))
            .map((elem) => searchRemoteUser('@' + elem, petitionBy))
          await Promise.allSettled(remoteUsersPromises.flat().concat(localUsers))
          localUsers = await Promise.allSettled(localUsers)
          const remoteUsers: { id: string; url: string }[] = (await Promise.allSettled(remoteUsersPromises.flat()))
            .filter((elem) => elem.status === 'fulfilled' && elem.value && elem.value.length > 0)
            .map((elem) => (elem.status === 'fulfilled' ? elem.value : []))
            .flat()
            .filter((elem) => elem != null)
            .map((elem) => {
              return { id: elem.id, url: elem.url }
            })
          const localUsersData: { id: string; url: string }[] = localUsers
            .filter((elem) => elem.status === 'fulfilled')
            .filter((elem) => elem.value != undefined)
            .map((elem) => {
              return { id: elem.value.id, url: elem.value.url }
            })
          const foundUrls = remoteUsers
            .map((elem) => elem.url)
            .concat(localUsersData.map((elem) => `@${elem.url}@${environment.instanceUrl}`))
          const errors = lines.filter((elem) => !foundUrls.includes('@' + elem))
          let idsToFollow = remoteUsers.map((elem) => elem.id).concat(localUsersData.map((elem) => elem.id))
          const alreadyFollowing = await Follows.findAll({
            where: {
              followerId: petitionBy.id,
              followedId: {
                [Op.in]: idsToFollow
              }
            }
          })
          const alreadyFollowingIds: string[] = alreadyFollowing.map((elem: any) => elem.followedId)
          idsToFollow = idsToFollow.filter((elem) => !alreadyFollowingIds.includes(elem))
          const followPetitions = idsToFollow.map((elem) => follow(petitionBy.id, elem))
          const followResults = await Promise.allSettled(followPetitions)
          res.send({
            success: true,
            newFollows: followResults.filter((elem) => elem.status === 'fulfilled' && elem.value === true).length,
            alreadyFollowing: alreadyFollowing.length,
            errors: errors
          })
          await fs.unlink(req.file.path)
        } catch (error: any) {
          res.send({
            success: false,
            errorMessage: error.message
          })
          await fs.unlink(req.file.path)
        }
      } else {
        res.sendStatus(500)
      }
    }
  )
}
