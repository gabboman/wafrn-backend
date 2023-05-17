import { FederatedHost, User } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getPetitionSigned } from './getPetitionSigned'
import { Queue } from 'bullmq';

const currentlyWritingPosts: string[] = []

const updateUsersQueue = new Queue('UpdateUsers', {
  connection: environment.bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true, removeOnFail: 1000
  }
} );

async function getRemoteActor(actorUrl: string, user: any, level = 0): Promise<any> {
  if (level === 100) {
    //Actor is not valid.
    return await User.findOne({
      where: {
        url: environment.deletedUser
      }
    })
  }
  const url = new URL(actorUrl)
  const hostBanned = await FederatedHost.findOne({
    where: {
      displayName: url.host,
      blocked: true
    }
  })

  if (hostBanned) {
    return await User.findOne({
      where: {
        url: environment.deletedUser
      }
    })
  }

  let remoteUser = await User.findOne({
    where: {
      remoteId: actorUrl
    }
  })
  // we check if the user has changed avatar and stuff
  const validUntil = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
  if (remoteUser?.updatedAt < validUntil) {
    updateUsersQueue.add('updateUser', { userToUpdate: actorUrl, petitionBy: user }, {jobId: actorUrl})
  }

  if (!remoteUser) {
    if (currentlyWritingPosts.indexOf(actorUrl) !== -1) {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      return await getRemoteActor(actorUrl, user, level + 1)
    } else {
      currentlyWritingPosts.push(actorUrl)
      const currentlyWritingObject = currentlyWritingPosts.indexOf(actorUrl)
      try {
        currentlyWritingPosts.push(actorUrl)
        const userPetition = await getPetitionSigned(user, actorUrl)
        const userToCreate = {
          url: `@${userPetition.preferredUsername}@${url.host}`,
          email: null,
          description: userPetition.summary,
          avatar: userPetition.icon?.url ? userPetition.icon.url : `${environment.mediaUrl}/uploads/default.webp`,
          password: 'NOT_A_WAFRN_USER_NOT_REAL_PASSWORD',
          publicKey: userPetition.publicKey?.publicKeyPem,
          remoteInbox: userPetition.inbox,
          remoteId: actorUrl,
          activated: true
        }
        remoteUser = await User.create(userToCreate)

        let federatedHost = await FederatedHost.findOne({
          where: {
            displayName: url.host.toLocaleLowerCase()
          }
        })
        if (!federatedHost) {
          const federatedHostToCreate = {
            displayName: url.host,
            publicInbox: userPetition.endpoints?.sharedInbox
          }
          federatedHost = await FederatedHost.create(federatedHostToCreate)
        }

        await federatedHost.addUser(remoteUser)
      } catch (error) {
        logger.trace({ message: 'error fetching user', error: error })
      }
      currentlyWritingPosts[currentlyWritingObject] = '_OBJECT_FINALLY_WRITTEN_'
    }
  }

  return remoteUser
}

function getUserProperties(userPetition: any) {
  return {
    //url: `@${userPetition.preferredUsername}@${url.host}`,
    email: null,
    description: userPetition.summary,
    avatar: userPetition.icon?.url ? userPetition.icon.url : `${environment.mediaUrl}/uploads/default.webp`,
    password: 'NOT_A_WAFRN_USER_NOT_REAL_PASSWORD',
    publicKey: userPetition.publicKey?.publicKeyPem,
    remoteInbox: userPetition.inbox,
    remoteId: userPetition.id,
    activated: true
  }
}

export { getRemoteActor }
