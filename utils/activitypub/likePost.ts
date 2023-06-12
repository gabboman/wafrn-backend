import { Op, Sequelize } from 'sequelize'
import { FederatedHost, Post, User, sequelize } from '../../db'
import { environment } from '../../environment'
import { activityPubObject } from '../../interfaces/fediverse/activityPubObject'
import { postPetitionSigned } from './postPetitionSigned'
import { logger } from '../logger'
import { Queue } from 'bullmq'
import _ from 'underscore'

const sendPostQueue = new Queue('sendPostToInboxes', {
  connection: environment.bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnFail: 25000
  }
})

async function likePostRemote(like: any, dislike = false) {
  const user = await User.findOne({
    where: {
      id: like.userId
    }
  })
  const likedPost = await Post.findOne({
    where: {
      id: like.postId
    },
    include: [
      {
        model: User,
        as: 'user'
      }
    ]
  })
  const stringMyFollowers = `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/followers`
  const ownerOfLikedPost = likedPost.user.remoteId
  const likeObject: activityPubObject = !dislike
    ? {
        '@context': ['https://www.w3.org/ns/activitystreams'],
        actor: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`,
        to:
          likedPost.privacy / 1 === 10
            ? [ownerOfLikedPost]
            : likedPost.privacy / 1 === 0
            ? ['https://www.w3.org/ns/activitystreams#Public', stringMyFollowers]
            : [stringMyFollowers],
        cc: likedPost.privacy / 1 === 0 ? [ownerOfLikedPost] : [],
        id: `${environment.frontendUrl}/fediverse/likes/${like.userId}/${like.postId}`,
        object: likedPost.remotePostId,
        type: 'Like'
      }
    : {
        '@context': ['https://www.w3.org/ns/activitystreams'],
        actor: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`,
        to:
          likedPost.privacy / 1 === 10
            ? [ownerOfLikedPost]
            : likedPost.privacy / 1 === 0
            ? ['https://www.w3.org/ns/activitystreams#Public', stringMyFollowers]
            : [stringMyFollowers],
        cc: likedPost.privacy / 1 === 0 ? [ownerOfLikedPost] : [],
        id: `${environment.frontendUrl}/fediverse/undo/likes/${like.userId}/${like.postId}`,
        object: `${environment.frontendUrl}/fediverse/likes/${like.userId}/${like.postId}`,
        type: 'Undo'
      }
  // petition to owner of the post:
  const ownerOfPostLikePromise = likedPost.user.remoteInbox
    ? postPetitionSigned(likeObject, user, likedPost.user.remoteInbox)
    : true
  // servers with shared inbox
  let serversToSendThePost
  // for servers with no shared inbox
  let usersToSendThePost
  switch (likedPost.privacy) {
    case 1: {
      serversToSendThePost = FederatedHost.findAll({
        where: {
          publicInbox: { [Op.ne]: null },
          blocked: { [Op.ne]: true },
          literal: sequelize.literal(
            `id in (SELECT federatedHostId from users where users.id IN (SELECT followerId from follows where followedId = '${likedPost.userId}') and federatedHostId is not NULL)`
          )
        }
      })
      usersToSendThePost = usersToSendThePost = FederatedHost.findAll({
        where: {
          publicInbox: { [Op.eq]: null },
          blocked: false
        },
        include: [
          {
            model: User,
            attributes: ['remoteInbox'],
            where: {
              banned: false,
              literal: Sequelize.literal(
                `users.id IN (SELECT followerId from follows where followedId = "${likedPost.userId}")`
              )
            }
          }
        ]
      })

      break
    }
    case 10: {
      serversToSendThePost = []
      usersToSendThePost = []
      break
    }
    default: {
      serversToSendThePost = FederatedHost.findAll({
        where: {
          publicInbox: { [Op.ne]: null },
          blocked: false
        }
      })
      usersToSendThePost = FederatedHost.findAll({
        where: {
          publicInbox: { [Op.eq]: null },
          blocked: false
        },
        include: [
          {
            model: User,
            attributes: ['remoteInbox'],
            where: {
              banned: false
            }
          }
        ]
      })
    }
  }

  try {
    const ownerOfPostLikeResponse = await ownerOfPostLikePromise
  } catch (error) {
    logger.debug(error)
  }

  await Promise.all([serversToSendThePost, usersToSendThePost])
  serversToSendThePost = await serversToSendThePost
  usersToSendThePost = await usersToSendThePost
  // TODO convert this into a function. Code is repeated and a better thing should be made
  if (serversToSendThePost?.length > 0 || usersToSendThePost?.length > 0) {
    let inboxes: string[] = []
    inboxes = inboxes.concat(serversToSendThePost.map((elem: any) => elem.publicInbox))
    usersToSendThePost?.forEach((server: any) => {
      inboxes = inboxes.concat(server.users.map((elem: any) => elem.remoteInbox))
    })
    for await (const inboxChunk of _.chunk(inboxes, 10)) {
      await sendPostQueue.add('sencChunk', {
        objectToSend: likeObject,
        petitionBy: user.dataValues,
        inboxList: inboxChunk
      })
    }
  }
}

export { likePostRemote }
