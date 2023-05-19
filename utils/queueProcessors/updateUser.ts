import { Worker } from 'bullmq'
import { getPetitionSigned } from '../activitypub/getPetitionSigned'
import { User } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'

const updateUserWorker = new Worker(
  'UpdateUsers',
  async (job) => {
    try {
      const userPetition = await getPetitionSigned(job.data.petitionBy, job.data.userToUpdate)
      const remoteUser = User.findOne({
        where: {
          remoteId: job.data.userToUpdate
        }
      })
      remoteUser.description = userPetition.summary
      remoteUser.avatar = userPetition.icon?.url
        ? userPetition.icon.url
        : `${environment.mediaUrl}/uploads/default.webp`
      remoteUser.updatedAt = new Date()
      await remoteUser.save()
    } catch (error) {
      logger.info(`Failed to update user ${job.data.userToUpdate}`)
    }
  },
  {
    connection: environment.bullmqConnection
  }
)

export { updateUserWorker }
