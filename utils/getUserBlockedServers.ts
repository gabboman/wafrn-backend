import { Op } from 'sequelize'
import { Blocks, Follows, ServerBlock, User } from '../db'
import getBlockedIds from './getBlockedIds'
import { redisCache } from './redis'

export default async function getUserBlockedServers(userId: string): Promise<string[]> {
  const cacheResult = await redisCache.get('serverblocks:' + userId)
  if (cacheResult) {
    return JSON.parse(cacheResult)
  }
  try {
    const blocksServers = await ServerBlock.findAll({
        where: {
          userBlockerId: userId
        }
      })
    const result = blocksServers.map((elem: any) => elem.dataValues)
    redisCache.set('serverblocks:' + userId, JSON.stringify(result))
    return result as string[]
  } catch (error) {
    return []
  }
}
