import { getRemoteActor } from '../activitypub/getRemoteActor'
import { redisCache } from '../redis'

async function getKey(remoteUserUrl: string, adminUser: any) {
  const cachedKey = await redisCache.get('key:' + remoteUserUrl)
  const remoteKey = cachedKey ? cachedKey : (await getRemoteActor(remoteUserUrl, adminUser)).publicKey
  if (!cachedKey && remoteKey) {
    redisCache.set('key:' + remoteUserUrl, remoteKey)
  }
  return remoteKey
}

export { getKey }
