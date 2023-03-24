import { User } from '../db'

export default async function getFollowedsIds (userId: string) {
  try {
    const usr = await User.findOne({
      where: { id: userId },
      attributes: ['id']
    })
    const followed = await usr.getFollowed()
    const result = followed.map((followed: any) => followed.id)
    result.push(userId)
    return result as string[]
  } catch (error) {
    return []
  }
}
