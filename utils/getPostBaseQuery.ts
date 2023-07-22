import { Request } from 'express'
import { Emoji, Media, Post, PostTag, User, UserLikesPostRelations } from '../db'
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
            as: 'user',
            attributes: ['avatar', 'url', 'description', 'id']
          },
          {
            model: Media,
            attributes: ['id', 'NSFW', 'description', 'url', 'adultContent', 'external']
          },
          {
            model: PostTag,
            attributes: ['tagName']
          },
          {
            model: UserLikesPostRelations,
            attributes: ['userId']
          },
          {
            model: User,
            as: 'mentionPost',
            attributes: ['url', 'id', 'avatar']
          },
          {
            model: Emoji
          }
        ]
      },
      {
        model: User,
        as: 'user',
        attributes: ['avatar', 'url', 'description', 'id']
      },
      {
        model: Media,
        attributes: ['id', 'NSFW', 'description', 'url', 'adultContent', 'external']
      },
      {
        model: PostTag,
        attributes: ['tagName']
      },
      {
        model: User,
        as: 'mentionPost',
        attributes: ['url', 'id', 'avatar']
      },
      {
        model: UserLikesPostRelations,
        attributes: ['userId']
      },
      {
        model: Emoji
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: POSTS_PER_PAGE,
    offset: page * POSTS_PER_PAGE
  }
}
