import { Op } from 'sequelize'
import { FederatedHost, User } from '../../db'
import { environment } from '../../environment'
import { postToJSONLD } from './postToJSONLD'
import { LdSignature } from './rsa2017'
import _ from 'underscore'
import { Queue } from 'bullmq'

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
async function federatePostHasBeenEdited(postToEdit: any) {
  const user = await User.findByPk(postToEdit.userId)

  const postAsJSONLD = await postToJSONLD(postToEdit)
  const objectToSend = {
    '@context': [`${environment.frontendUrl}/contexts/litepub-0.1.jsonld`],
    actor: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`,
    to: postAsJSONLD.to,
    cc: postAsJSONLD.cc,
    id: `${environment.frontendUrl}/fediverse/edit/post/${postToEdit.id}/${new Date().getTime()}`,
    object: postAsJSONLD.object,
    type: 'Update'
  }

  let serversToSendThePost =
    postToEdit.privacy === 10
      ? []
      : FederatedHost.findAll({
          where: {
            publicInbox: { [Op.ne]: null },
            blocked: false
          }
        })
  let usersToSendThePost =
    postToEdit.privacy === 10
      ? []
      : FederatedHost.findAll({
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
  let mentionedUsers = User.findAll({
    attributes: ['remoteInbox'],
    where: {
      federatedHostId: { [Op.ne]: null },
      id: {
        [Op.in]: (await postToEdit.getMentionPost()).map((usr: any) => usr.id)
      }
    }
  })
  await Promise.all([serversToSendThePost, usersToSendThePost, mentionedUsers])
  serversToSendThePost = await serversToSendThePost
  usersToSendThePost = await usersToSendThePost
  mentionedUsers = await mentionedUsers
  let urlsToSendPost = []
  if (mentionedUsers) {
    urlsToSendPost = mentionedUsers.map((mention: any) => mention.remoteInbox)
  }
  if (serversToSendThePost) {
    urlsToSendPost = urlsToSendPost.concat(serversToSendThePost.map((server: any) => server.publicInbox))
  }
  if (usersToSendThePost) {
    urlsToSendPost = urlsToSendPost.concat(usersToSendThePost.map((usr: any) => usr.remoteInbox))
  }

  const ldSignature = new LdSignature()
  const bodySignature = await ldSignature.signRsaSignature2017(
    objectToSend,
    user.privateKey,
    `${environment.frontendUrl}/fediverse/blog/${user.url.toLocaleLowerCase()}`,
    environment.instanceUrl,
    new Date()
  )
  for await (const inboxChunk of _.chunk(urlsToSendPost, 50)) {
    await sendPostQueue.add(
      'sencChunk',
      {
        objectToSend: { ...objectToSend, signature: bodySignature.signature },
        petitionBy: user.dataValues,
        inboxList: inboxChunk
      },
      {
        priority: 50
      }
    )
  }
}

export { federatePostHasBeenEdited }
