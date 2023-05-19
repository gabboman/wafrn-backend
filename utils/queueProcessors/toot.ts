import { Worker } from 'bullmq'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getPostThreadRecursive } from '../activitypub/getPostThreadRecursive'
import { signAndAccept } from '../activitypub/signAndAccept'
import { User } from '../../db'

const tootWorker = new Worker(
  'createToot',
  async (job) => {
    const user = User.cache(job.data.petitionBy).findOne({
      where: {
        id: job.data.petitionBy
      }
    })
    const body = job.data.req
    const remoteUser = job.data.remoteUser
    try {
      const postRecived = body.object
      if (postRecived.type === 'Note') {
        await getPostThreadRecursive(user, postRecived.id, postRecived)
        await signAndAccept({ body: body }, remoteUser, user)
      } else {
        logger.info(`post type not implemented: ${postRecived.type}`)
      }
    } catch (error) {
      logger.info(`Failed to get toot ${job.id}`)
    }
  },
  {
    connection: environment.bullmqConnection
  }
)

export { tootWorker }
