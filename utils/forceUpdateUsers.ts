import { User } from '../db'
import { Queue } from 'bullmq'
import { environment } from '../environment'
import { Op } from 'sequelize'

async function updateAllUsers() {
  const updateUsersQueue = new Queue('UpdateUsers', {
    connection: environment.bullmqConnection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 1000
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
  allRemoteUsers.forEach((actor: any) => {
    console.log(actor.url)
    updateUsersQueue.add(
      'updateUser',
      { userToUpdate: actor.remoteId, petitionBy: adminUser },
      { jobId: actor.remoteId }
    )
  })
}

updateAllUsers()
