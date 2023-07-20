import { FederatedHost, User } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getPetitionSigned } from './getPetitionSigned'
import { Queue } from 'bullmq'

const updateUsersQueue = new Queue('UpdateUsers', {
  connection: environment.bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000
  }
})

const deletedUser = User.findOne({
  where: {
    url: environment.deletedUser
  }
})

let hostCacheUpdated: Date = new Date()
const hostCache: Map<string, any> = new Map()

let userCacheUpdated: Date = new Date()
const userCache: Map<string, any> = new Map()

function updateHostCache() {
  hostCacheUpdated = new Date()
  hostCache.clear()
  FederatedHost.findAll({}).then((hosts: any) => {
    hosts.forEach((host: any) => {
      hostCache.set(host.displayName, host)
    })
  })
}

function updateUserCache() {
  userCacheUpdated = new Date()
  userCache.clear()
  User.findAll().then((users: any) => {
    users.forEach((user: any) => {
      userCache.set(user.remoteId, user)
    })
  })
}

async function getUserFromCache(remoteId: string) {
  // cache for one hour
  if (new Date().getTime() - userCacheUpdated.getTime() > 60 * 60 * 1000) {
    updateUserCache()
  }
  let result = userCache.get(remoteId)
  if (!result) {
    result = await User.findOne({
      where: {
        remoteId: remoteId
      }
    })
    userCache.set(remoteId, result)
  }
  return result
}

async function getHostFromCache(displayName: string): Promise<any> {
  // cache hosts for 5 minutes only
  if (new Date().getTime() - hostCacheUpdated.getTime() > 60 * 5 * 1000) {
    updateHostCache()
  }
  let result = hostCache.get(displayName)
  if (!result) {
    result = await FederatedHost.findOne({
      where: {
        displayName: displayName
      }
    })
    hostCache.set(displayName, result)
  }
  return result
}

updateHostCache()
updateUserCache()

async function getRemoteActor(actorUrl: string, user: any, level = 0, forceUpdate = false): Promise<any> {
  if (level === 100) {
    //Actor is not valid.
    return await deletedUser
  }
  const url = new URL(actorUrl)
  const hostQuery = await getHostFromCache(url.host)
  const hostBanned = hostQuery?.blocked

  if (hostBanned) {
    return await deletedUser
  }
  let remoteUser = await getUserFromCache(actorUrl)
  // we check if the user has changed avatar and stuff
  const validUntil = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
  if ((remoteUser && new Date(remoteUser.updatedAt).getTime() < validUntil.getTime()) || forceUpdate) {
    updateUsersQueue.add('updateUser', { userToUpdate: actorUrl, petitionBy: user }, { jobId: actorUrl })
    userCache.get(actorUrl).updatedAt = new Date()
  }

  if (!remoteUser) {
    try {
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
  }
  if (remoteUser && remoteUser.banned) {
    return await deletedUser
  }
  return remoteUser
}

export { getRemoteActor }
