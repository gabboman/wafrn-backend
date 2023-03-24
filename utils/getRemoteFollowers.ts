import { User } from '../db'
import { Op } from 'sequelize'

export default async function getRemoteFollowers (usr: any) {
  try {
    const followed = await usr.getFollowed({
      where: {
        remoteInbox: {[Op.ne]: null}
      }
    })
    const result = followed.map((followed: any) => followed.remoteInbox)
    return result
  } catch (error) {
    return []
  }
}
