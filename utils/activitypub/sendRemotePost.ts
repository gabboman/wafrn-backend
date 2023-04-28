import { Op } from 'sequelize'
import { logger } from '../logger'
import { postPetitionSigned } from './postPetitionSigned'
import { postToJSONLD } from './postToJSONLD'
import { LdSignature } from './rsa2017'
import { User } from '../../db'
import getRemoteFollowers from './getRemoteFollowers'
import { environment } from '../../environment'
const _ = require('underscore')

async function sendRemotePost(localUser: any, post: any) {
  let usersToSendThePost = await getRemoteFollowers(localUser)
  if (post.privacy / 1 === 10) {
    const userIdsToSendPost = (await post.getPostMentionsUserRelations()).map((mention: any) => mention.userId)
    const mentionedUsersFullModel = await User.findAll({
      where: {
        id: { [Op.in]: userIdsToSendPost },
        remoteInbox: { [Op.ne]: null }
      }
    })
    usersToSendThePost = _.groupBy(mentionedUsersFullModel, 'federatedHostId')
  }

  if (post.privacy / 1 === 0) {
    const allUserInbox = await User.findAll({
      where: {
        remoteInbox: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: 'DELETED_USER' }] },
        activated: true
      }
    })
    usersToSendThePost = _.groupBy(allUserInbox, 'federatedHostId')
  }
  if (usersToSendThePost && Object.keys(usersToSendThePost).length > 0) {
    const objectToSend = await postToJSONLD(post, usersToSendThePost)
    const ldSignature = new LdSignature()
    const bodySignature: any = await ldSignature.signRsaSignature2017(
      objectToSend,
      localUser.privateKey,
      `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLocaleLowerCase()}`,
      environment.instanceUrl,
      new Date(post.createdAt)
    )

    for (const remoteHost of Object.keys(usersToSendThePost)) {
      let remainingUsers = 5 // we send a post up to 5 times. may work may wont work
      for await (const remoteuser of usersToSendThePost[remoteHost]) {
        try {
          const response = await postPetitionSigned(
            { ...objectToSend, signature: bodySignature.signature },
            localUser,
            remoteuser.remoteInbox
          )
          //const response = await postPetitionSigned(objectToSend, localUser, remoteuser.remoteInbox)
          remainingUsers--
          if (remainingUsers === 0) {
            break
          }
        } catch (error) {
          logger.trace({
            message: 'Could not send post to remote user',
            url: remoteuser.remoteInbox,
            error: error
          })
        }
      }
    }
  }
}

export { sendRemotePost }
