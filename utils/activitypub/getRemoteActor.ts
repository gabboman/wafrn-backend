import { Job, Queue, QueueEvents } from 'bullmq'
import { User } from '../../db'
import { environment } from '../../environment'

import { logger } from '../logger'

const deletedUser = environment.forceSync
  ? undefined
  : User.findOne({
      where: {
        url: environment.deletedUser
      }
    })
const queue = new Queue('getRemoteActorId', {
  connection: environment.bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnFail: 25000
  }
})
const queueEvents = new QueueEvents('getRemoteActorId', {
  connection: environment.bullmqConnection
})
async function getRemoteActor(actorUrl: string, user: any, forceUpdate = false): Promise<any> {
  let remoteUser = await deletedUser
  try {
    // we check its a string. A little bit dirty but could be worse
    actorUrl.startsWith(environment.frontendUrl + '/fediverse/blog/')
    const job = await queue.add(
      'getRemoteActorId',
      { actorUrl: actorUrl, userId: user.id, forceUpdate: forceUpdate }
    )
    const userId = await job.waitUntilFinished(queueEvents)
    remoteUser = await User.findByPk(userId)
    if (!remoteUser || (remoteUser && remoteUser.banned)) {
      remoteUser = await deletedUser
    }
  } catch (error) {
    logger.trace(`Error fetching user ${actorUrl}`)
  }
  return remoteUser
}

export { getRemoteActor }
