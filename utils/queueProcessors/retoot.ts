import { Worker } from 'bullmq'
import { Post } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getPostThreadRecursive } from '../activitypub/getPostThreadRecursive'
import { signAndAccept } from '../activitypub/signAndAccept'

const retootWorker = new Worker(
  'createRetoot',
  async (job) => {
    const user = job.data.petitionBy;
    const req = job.data.req;
    const remoteUser = job.data.remoteUser;
    try {
        const retooted_content = await getPostThreadRecursive(user, req.body.object)
        const postToCreate = {
          content: '',
          content_warning: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: remoteUser.id,
          remotePostId: req.body.id
        }
        const newToot = await Post.create(postToCreate)
        await newToot.setParent(retooted_content)
        await newToot.save()
        await signAndAccept(req, remoteUser, user)
    } catch (error) {
      logger.info(`Failed to get retoot user ${job.id}`)
    }
  },
  {
    connection: environment.bullmqConnection
  }
)

export { retootWorker }
