import { User } from '../db'
import { Job, Queue } from 'bullmq'
import { environment } from '../environment'
import { Op } from 'sequelize'
import { getRemoteActorIdProcessor } from './queueProcessors/getRemoteActorIdProcessor'

async function updateAllUsers() {
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
  for await (const actor of allRemoteUsers) {
    console.log(actor.url)
    await getRemoteActorIdProcessor({
      data: { actorUrl: actor.remoteId, userId: adminUser.id, forceUpdate: true }
    } as Job)
  }
}

updateAllUsers()
