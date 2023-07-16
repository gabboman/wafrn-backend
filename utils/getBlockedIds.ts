import { Blocks, User } from '../db'

export default async function getBlockedIds(userId: string): Promise<string[]> {
  try {
    return await Blocks.findAll({
      where: {
        blockerId: userId
      }
    })
  } catch (error) {
    return []
  }
}
