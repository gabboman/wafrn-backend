import { Follows } from '../db'

export default async function getFollowedsIds(userId: string): Promise<string[]> {
  try {
    // TODO Utilize redis cache for this. We need to make sure every time follows get updated so does cache
    const followed = await Follows.findAll({
      attributes: ['followedId'],
      where: {
        followerId: userId,
        accepted: true
      }
    })
    const result = followed.map((followed: any) => followed.followedId)
    result.push(userId)
    return result as string[]
  } catch (error) {
    return []
  }
}
