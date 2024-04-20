import { User } from '../db'
import { Queue } from 'bullmq'
import { environment } from '../environment'
import { Op } from 'sequelize'
import { getRemoteActor } from './activitypub/getRemoteActor'

async function updateAllUsers() {
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
  console.log('lets a update all users that we caaaaaaaaan')

  const adminUser = await User.findOne({
    where: {
      url: environment.adminUser
    }
  })
  const allRemoteUsers = await User.findAll({
    where: {
      url: {
        [Op.like]: '@%@%'
      }
    }
  })
  allRemoteUsers.forEach(async (actor: any) => {
    console.log(actor.url)
    await queue.add(
      'getRemoteActorId',
      { actorUrl: actor.url, userId: adminUser, forceUpdate: true }
    )
  })
}

updateAllUsers()
