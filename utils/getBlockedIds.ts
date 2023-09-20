import { Op } from 'sequelize'
import { Blocks, Mutes, User } from '../db'

export default async function getBlockedIds(userId: string, includeMutes = true): Promise<string[]> {
  try {
    // TODO should we redis this?
    const blocks = Blocks.findAll({
      where: {
        [Op.or]: [
          {
            blockerId: userId
          },
          {
            blockedId: userId
          }
        ]
      }
    })
    const mutes = includeMutes
      ? Mutes.findAll({
          where: {
            muterId: userId
          }
        })
      : []
    await Promise.all([blocks, mutes])
    return (await blocks)
      .map((block: any) => (block.blockerId !== userId ? block.blockerId : block.blockedId))
      .concat((await mutes).map((mute: any) => mute.mutedId))
  } catch (error) {
    return []
  }
}
