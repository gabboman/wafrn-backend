import { environment } from '../../environment'
import { postPetitionSigned } from './postPetitionSigned'

async function remoteUnfollow(localUser: any, remoteUser: any) {
  const petitionBody = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${environment.frontendUrl}/fediverse/follows/${localUser.id}/${remoteUser.id}/undo`,
    type: 'Undo',
    actor: `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}`,
    object: {
      actor: `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}`,
      type: 'Follow',
      object: remoteUser.remoteId,
      id: `${environment.frontendUrl}/fediverse/follows/${localUser.id}/${remoteUser.id}`
    }
  }
  const followPetition = await postPetitionSigned(petitionBody, localUser, remoteUser.remoteInbox)
  return followPetition
}

export { remoteUnfollow }
