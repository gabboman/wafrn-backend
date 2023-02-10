import { User } from '../models'

export default async function getRemoteFollowers (userId: string) {
  try {
    const usr = await User.findOne({
      where: { id: userId },
      attributes: ['id']
    })
    const followed = await usr.getFollowed()
    const result = followed.map((followed: any) => followed.remoteInbox).filter((elem: string) => elem)
    return result
  } catch (error) {
    return []
  }
}
