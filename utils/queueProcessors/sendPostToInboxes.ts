import { Job } from 'bullmq'
import { logger } from '../logger'
import { postPetitionSigned } from '../activitypub/postPetitionSigned'

async function sendPostToInboxes(job: Job) {
  const inboxes: string[] = job.data.inboxList
  const localUser = job.data.petitionBy
  const objectToSend = job.data.objectToSend

  for await (const remoteInbox of inboxes) {
    try {
      const response = await postPetitionSigned(objectToSend, localUser, remoteInbox)
    } catch (error) {
      logger.trace(error)
    }
  }
}

export { sendPostToInboxes }
