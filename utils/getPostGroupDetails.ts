/* eslint-disable guard-for-in */
import {Post} from '../models';
import {Op} from 'sequelize';

export default async function getPosstGroupDetails(postGroup: any[]) {
  // eslint-disable-next-line max-len
  let postIds: string[] = postGroup.map((elem) => elem.ancestors[0]? elem.ancestors[0].id : elem.id);
  postIds = [...new Set(postIds)];
  // eslint-disable-next-line max-len
  // TODO optimize this! I feel like this might be more optimizable. This is one of those things
  const fullPostTree = await Post.findAll({
    where: {
      id: {[Op.in]: postIds},
    },
    attributes: [
      'id',
    ],
    include: [
      {
        model: Post,
        as: 'descendents',
        attributes: [
          // NSFW is just a boolean, so we would bring the minimum data
          'nsfw',
        ],
      },
    ],
  });
  return postGroup.map((elem) => {
    let notes = 0;
    fullPostTree.forEach((elementWithNotes: any) => {
      const idtoCheck = elem.ancestors[0] ? elem.ancestors[0].id : elem.id;
      if (idtoCheck === elementWithNotes.id) {
        notes = elementWithNotes.descendents.length;
      }
    });
    return {...elem.dataValues, 'notes': notes};
  });
}
