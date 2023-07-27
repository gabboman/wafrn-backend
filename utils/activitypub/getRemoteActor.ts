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

const deletedUser = environment.forceSync? undefined : User.findOne({
  where: {
    url: environment.deletedUser
  }
})

const hostCache: Map<string, any> = new Map()

// we only cache the uuids
const userCache: Map<string, string> = new Map()

function updateHostCache() {
  if (environment.forceSync) {
    return undefined;
  }
  hostCache.clear()
  FederatedHost.findAll({}).then((hosts: any) => {
    hosts.forEach((host: any) => {
      hostCache.set(host.displayName, host.id)
    })
  })
}

function updateUserCache() {
  if (environment.forceSync) {
    return undefined;
  }
  userCache.clear()
  User.findAll().then((users: any) => {
    users.forEach((user: any) => {
      userCache.set(user.remoteId, user.id)
    })
  })
}

async function getUserFromCache(remoteId: string) {
  let result = undefined;
  let userId = userCache.get(remoteId)
  if(userId) {
    result = await User.findByPk(userId)
    if (result.id != userId ) {
      console.log('findbypk did not returned the correct thing');
      userId = undefined
    }

  }
  if (!userId) {
    result = await User.findOne({
      where: {
        remoteId: remoteId
      }
    });
    userCache.set(remoteId, result.id)
  }
  return result
}

async function getHostFromCache(displayName: string): Promise<any> {
  const cacheResult = hostCache.get(displayName)
  let result: any;
  if (!cacheResult) {
    result = await FederatedHost.findOne({
      where: {
        displayName: displayName
      }
    })
    hostCache.set(displayName, result.id)
  } else {
    result = await FederatedHost.findByPk(cacheResult)
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
          displayName: url.host.toLocaleLowerCase(),
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
