import {Op} from 'sequelize';
import {Post, User, Media, Tag} from '../models';

export default async function getReblogs(user: any) {
  const userId = user.id;
  const userPostsWithReblogs = await Post.findAll({
    include: [
      {
        model: Post,
        as: 'descendents',
        where: {
          createdAt: {
            [Op.gt]: new Date(user.lastTimeNotificationsCheck),
          },
        },
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description', 'id'],
          },
          {
            model: Media,
            attributes: ['id', 'NSFW', 'description', 'url'],
          },
        ],
      },
      {
        model: User,
        attributes: ['avatar', 'url', 'description'],
      },
      {
        model: Media,
        attributes: ['id', 'NSFW', 'description', 'url'],
      },
      {
        model: Tag,
        attributes: ['tagName'],
      },
    ],
    where: {
      userId: userId,
    },
  });
  const result: any[] = [];
  userPostsWithReblogs.forEach((postWithReblogs: any) => {
    try {
      postWithReblogs.descendents.forEach((elem: any) => {
        // TODO fix dirty hack
        const elemProcessed: any = JSON.parse(JSON.stringify(elem));
        elemProcessed['createdAt'] = elem.createdAt.getTime();
        result.push(elemProcessed);
      });
    } catch (error) {
      console.error(error);
    }
  });
  return result;
}
