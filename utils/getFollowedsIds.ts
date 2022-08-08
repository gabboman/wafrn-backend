import {User} from '../models';

export default async function getFollowedsIds(userId: string) {
  const usr = await User.findOne({
    where: {id: userId},
    attributes: ['id'],
  });
  const followed = await usr.getFollowed();
  const result = followed.map((followed: any) => followed.id);
  result.push(userId);
  return result as string[];
}
