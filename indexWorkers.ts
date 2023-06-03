import { Job, Worker } from 'bullmq'
import { logger } from './utils/logger'
import { environment } from './environment'
import { inboxWorker } from './utils/queueProcessors/inbox'
import { updateUserWorker } from './utils/queueProcessors/updateUser'
import { sendRemotePostWorker } from './utils/queueProcessors/sendRemotePost'

const workerInbox = new Worker('inbox', (job: Job) => inboxWorker(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency
})

const workerUpdateRemoteUsers = new Worker('updateUser', (job: Job) => updateUserWorker(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency
})

const workerSendPosts = new Worker('sendPost', (job: Job) => sendRemotePostWorker(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency,
  lockDuration: 300000
})

workerInbox.on('completed', (job) => {
  // console.log(`${job.id} has completed!`)
})

workerInbox.on('failed', (job, err) => {
  console.warn(`${job?.id} has failed with ${err.message}`)
})

workerSendPosts.on('completed', (job) => {
  // console.log(`${job.id} has completed!`)
})

workerSendPosts.on('failed', (job, err) => {
  console.warn(`sending post ${job?.id} has failed with ${err.message}`)
})

workerUpdateRemoteUsers.on('failed', (job, err) => {
  console.warn(`update user ${job?.id} has failed with ${err.message}`)
})
