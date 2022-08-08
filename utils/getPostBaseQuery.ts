import {Media, Post, PostMentionsUserRelation, Tag, User} from '../models';

export default function getPostBaseQuery(req: any) {
  return {
    include: [
      {
        model: Post,
        as: 'ancestors',
        include: [
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
          {
            model: PostMentionsUserRelation,
            attributes: ['userId'],
            include: [
              {
                model: User,
                attributes: ['avatar', 'url', 'description'],
              },
            ],
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
      {
        model: PostMentionsUserRelation,
        attributes: ['userId'],
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 20,
    offset: req.body?.page ? req.body.page * 20 : 0,
  };
}
