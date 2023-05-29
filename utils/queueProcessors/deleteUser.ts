import { Job, Worker } from 'bullmq'
import { getPetitionSigned } from '../activitypub/getPetitionSigned'
import { User } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { removeUser } from '../activitypub/removeUser'
async function deleteUserWorker(job: Job) {
  try {
    await `removeUser`(job.data.remoteId)
  } catch (error) {
    logger.info(`Failed to delete user ${job.data.remoteId}`)
  }
}

export { deleteUserWorker }
