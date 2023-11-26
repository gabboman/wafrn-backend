import { Request } from 'express'
import {
  Emoji,
  Media,
  Post,
  PostTag,
  QuestionPoll,
  QuestionPollAnswer,
  QuestionPollQuestion,
  User,
  UserLikesPostRelations
} from '../db'
import { environment } from '../environment'
import AuthorizedRequest from '../interfaces/authorizedRequest'

const POSTS_PER_PAGE = environment.postsPerPage

export default function getPostBaseQuery(req?: AuthorizedRequest) {
  const page = Number(req?.query.page) || 0
  const userPosterId = req?.jwtData?.userId ? req.jwtData.userId : environment.deletedUser
  return {
    include: [
      {
        model: Post,
        as: 'ancestors',
        include: [
          {
            model: QuestionPoll,
            include: [
              {
                model: QuestionPollQuestion,
                include: [
                  {
                    model: QuestionPollAnswer,
                    required: false,
                    where: {
                      userId: userPosterId
                    }
                  }
                ]
              }
            ]
          },
          {
            model: User,
            include: [
              {
                model: Emoji,
                required: false
              }
            ],
            as: 'user',
            attributes: ['avatar', 'remoteId', 'url', 'name', 'id']
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
            include: [
              {
                model: Emoji,
                required: false
              }
            ],
            as: 'mentionPost',
            attributes: ['url', 'name', 'id', 'avatar', 'remoteId']
          },
          {
            model: Emoji
          }
        ]
      },
      {
        model: QuestionPoll,
        include: [
          {
            model: QuestionPollQuestion,
            include: [
              {
                model: QuestionPollAnswer,
                required: false,
                where: {
                  userId: userPosterId
                }
              }
            ]
          }
        ]
      },
      {
        model: User,
        include: [
          {
            model: Emoji,
            required: false
          }
        ],
        as: 'user',
        attributes: ['avatar', 'url', 'name', 'id', 'remoteId']
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
        include: [
          {
            model: Emoji,
            required: false
          }
        ],
        as: 'mentionPost',
        attributes: ['url', 'name', 'id', 'avatar', 'remoteId']
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
