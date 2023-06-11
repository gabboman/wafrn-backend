import { Request } from 'express'
import { Media, Post, PostMentionsUserRelation, Tag, User, UserLikesPostRelations } from '../db'
import { environment } from '../environment'

const POSTS_PER_PAGE = environment.postsPerPage

export default function getPostBaseQuery(req?: Request) {
  const page = Number(req?.query.page) || 0
  return {
    include: [
      {
        model: Post,
        as: 'ancestors',
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description', 'id']
          },
          {
            model: Media,
            attributes: ['id', 'NSFW', 'description', 'url', 'adultContent', 'external']
          },
          {
            model: Tag,
            attributes: ['tagName']
          },
          {
            model: PostMentionsUserRelation,
            attributes: ['userId'],
            include: [
              {
                model: User,
                attributes: ['avatar', 'url', 'description', 'id']
              }
            ]
          },
          {
            model: UserLikesPostRelations,
            attributes: ['userId']
          }
        ]
      },
      {
        model: User,
        attributes: ['avatar', 'url', 'description', 'id']
      },
      {
        model: Media,
        attributes: ['id', 'NSFW', 'description', 'url', 'adultContent', 'external']
      },
      {
        model: Tag,
        attributes: ['tagName']
      },
      {
        model: PostMentionsUserRelation,
        attributes: ['userId'],
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description', 'id']
          }
        ]
      },
      {
        model: UserLikesPostRelations,
        attributes: ['userId']
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: POSTS_PER_PAGE,
    offset: page * POSTS_PER_PAGE
  }
}
