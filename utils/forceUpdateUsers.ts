import { User } from '../db'
import { Queue } from 'bullmq'
import { environment } from '../environment'
import { Op } from 'sequelize'
import { getRemoteActor } from './activitypub/getRemoteActor'

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
  allRemoteUsers.forEach(async (actor: any) => {
    console.log(actor.url)
    await getRemoteActor(actor.remoteId, adminUser, true)
  })
}

updateAllUsers()
