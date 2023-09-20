import { Op } from 'sequelize';
import { Blocks, Follows, User } from '../db'
import getBlockedIds from './getBlockedIds';

export default async function getFollowedsIds(userId: string, local = false): Promise<string[]> {
  //  should we redis this data?
  try {
    const usersWithBlocks = await getBlockedIds(userId)
    const whereObject: any = {
      followerId: userId,
      accepted: true,
      followedId: {
        [Op.notIn]: usersWithBlocks
      }
    };
    if(local) {
      whereObject['$follower.url$'] =  {
        [Op.notLike]: '@%'
      }
    }
    const followed = await Follows.findAll({
      attributes: ['followedId'],
      include: [{
        model: User,
        as: 'follower',
        attributes: ['url']
      }],
      where: whereObject
    })
    const result = followed.map((followed: any) => followed.followedId)
    result.push(userId)
    return result as string[]
  } catch (error) {
    return []
  }
}
