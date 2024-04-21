import { Job } from 'bullmq'
import { FederatedHost, User } from '../../db'
import { environment } from '../../environment'
import { getUserIdFromRemoteId } from '../cacheGetters/getUserIdFromRemoteId'
import { getFederatedHostIdFromUrl } from '../cacheGetters/getHostIdFromUrl'
import { getPetitionSigned } from '../activitypub/getPetitionSigned'
import { processUserEmojis } from '../activitypub/processUserEmojis'
import { fediverseTag } from '../../interfaces/fediverse/tags'

// This function will return userid after processing it.
async function getRemoteActorIdProcessor(job: Job) {
  
  const actorUrl: string = job.data.actorUrl
  const user = await User.findByPk(job.data.userId)
  const forceUpdate: boolean = job.data.forceUpdate
  let res = await getUserIdFromRemoteId(actorUrl)
  if (res === '' || forceUpdate) {
    const url = new URL(actorUrl)
    let federatedHost = await getHostFromCache(url.host)
    const hostBanned = federatedHost?.blocked
    if (hostBanned) {
      res = await getDeletedUser()
    } else {
      const userPetition = await getPetitionSigned(user, actorUrl)
      if (userPetition) {
        if (!federatedHost) {
          const federatedHostToCreate = {
            displayName: url.host.toLocaleLowerCase(),
            publicInbox: userPetition.endpoints?.sharedInbox
          }
          federatedHost = await FederatedHost.create(federatedHostToCreate)
        }
        const remoteMentionUrl = typeof userPetition.url === 'string' ? userPetition.url : ''
        const userData = {
          url: `@${userPetition.preferredUsername}@${url.host}`,
          name: userPetition.name ? userPetition.name : userPetition.preferredUsername,
          email: null,
          description: userPetition.summary,
          avatar: userPetition.icon?.url ? userPetition.icon.url : `${environment.mediaUrl}/uploads/default.webp`,
          headerImage: userPetition.image?.url ? userPetition.image.url : ``,
          password: 'NOT_A_WAFRN_USER_NOT_REAL_PASSWORD',
          publicKey: userPetition.publicKey?.publicKeyPem,
          remoteInbox: userPetition.inbox,
          remoteId: actorUrl,
          activated: true,
          federatedHostId: federatedHost.id,
          remoteMentionUrl: remoteMentionUrl,
          updatedAt: new Date()
        }
        let userRes
        if (res) {
          userRes = await User.findByPk(res)
          userRes.update(userData)
          await userRes.save()
        } else {
          userRes = await User.create(userData)
        }
        res = userRes.id
        await processUserEmojis(
          userRes,
          userPetition.tag?.filter((elem: fediverseTag) => elem.type === 'Emoji')
        )
      }
    }
  }
  return res
}

async function getHostFromCache(displayName: string): Promise<any> {
  const res = await FederatedHost.findByPk(await getFederatedHostIdFromUrl(displayName))
  return res
}

async function getDeletedUser() {
  return await getUserIdFromRemoteId(
    `https://${environment.instanceUrl}/fediverse/blog/${environment.deletedUser}`
  )
}

export { getRemoteActorIdProcessor }
