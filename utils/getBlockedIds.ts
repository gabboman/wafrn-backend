import { User } from '../db'

export default async function getBlockedIds (userId: string): Promise<string[]> {
  try {
    const usr = await User.findOne({
      where: {
        id: userId
      },
      attributes: ['id']
    })
    const blocked = usr.getBlocked()
    const blockedBy = usr.getBlocker()
    await Promise.all([blocked, blockedBy])
    let result = (await blocked).map((blocked: any) => blocked.id)
    result = result.concat((await blockedBy).map((blocker: any) => blocker.id))
    return result.filter((elem: string) => elem !== userId)
  } catch (error) {
    return []
  }
}
