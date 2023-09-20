import { Op } from 'sequelize';
import { Blocks, Follows, User } from '../db'
import getBlockedIds from './getBlockedIds';
import getFollowedsIds from './getFollowedsIds';

export default async function getNonFollowedLocalUsersIds(userId: string): Promise<string[]> {
  // TODO should we redis this data?
  try {
    const followedLocalUsers = getFollowedsIds(userId, true);
    const blockedUsers = getBlockedIds(userId);
    Promise.all([followedLocalUsers, blockedUsers])
    const nonFollowedUsers = await User.findAll({
        attributes: ['id'],
        where: {
            id: {
                [Op.notIn]: (await followedLocalUsers).concat(await blockedUsers)
            },
            url: {
                [Op.notLike]: '@%'
            }

        }
    })
    const result = nonFollowedUsers.map((notFollowed: any) => notFollowed.id)
    return result as string[]
  } catch (error) {
    return []
  }
}
