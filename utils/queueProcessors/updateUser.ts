import { Job, Worker } from 'bullmq'
import { getPetitionSigned } from '../activitypub/getPetitionSigned'
import { FederatedHost, User } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { processUserEmojis } from '../activitypub/processUserEmojis'
import { fediverseTag } from '../../interfaces/fediverse/tags'
import { getFederatedHostIdFromUrl } from '../cacheGetters/getHostIdFromUrl'

async function updateUserWorker(job: Job) {
  try {
    const userPetition = await getPetitionSigned(job.data.petitionBy, job.data.userToUpdate)
    const remoteUser = await User.findOne({
      where: {
        remoteId: job.data.userToUpdate
      }
    })
    if (userPetition && remoteUser) {
      remoteUser.description = userPetition.summary
      remoteUser.name = userPetition.name
      remoteUser.headerImage = userPetition.image?.url ? userPetition.image.url : ''
      remoteUser.avatar = userPetition.icon?.url
        ? userPetition.icon.url
        : `${environment.mediaUrl}/uploads/default.webp`
      remoteUser.updatedAt = new Date()
      const hostUrl = remoteUser.url.split('@')[2]
      if (hostUrl) {
        remoteUser.federatedHostId = await getFederatedHostIdFromUrl(hostUrl)
      }

      await processUserEmojis(
        remoteUser,
        userPetition.tag?.filter((elem: fediverseTag) => elem.type === 'Emoji')
      )
      await remoteUser.save()
    }
  } catch (error) {
    logger.trace(`Failed to update user ${job.data.userToUpdate}`)
    logger.trace(error)
    // TODO if user is deleted do stuff too
  }
}

export { updateUserWorker }
