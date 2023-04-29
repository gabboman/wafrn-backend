import { environment } from '../../environment'
import { postPetitionSigned } from './postPetitionSigned'

async function signAndAccept(req: any, remoteUser: any, user: any) {
  const acceptMessage = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: req.body.id,
    type: 'Accept',
    actor: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`,
    object: req.body
  }
  if (remoteUser.remoteInbox === '') {
    throw new Error('Remote inbox is empty')
  }
  return await postPetitionSigned(acceptMessage, await user, await remoteUser.remoteInbox)
}

export { signAndAccept }
