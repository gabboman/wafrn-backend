import { environment } from "../../environment"
import { postPetitionSigned } from "./postPetitionSigned"

async function remoteFollow (localUser: any, remoteUser: any) {
    const petitionBody = { '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${environment.frontendUrl}/fediverse/follows/${localUser.id}/${remoteUser.id}`,
    type: 'Follow',
    actor: `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}`,
    object: remoteUser.remoteId
   }
   const followPetition = await postPetitionSigned(petitionBody, localUser, remoteUser.remoteInbox)
    return followPetition
  }

export {remoteFollow}