import { Job, Worker } from 'bullmq'
import { logger } from './utils/logger'
import { environment } from './environment'
import { inboxWorker } from './utils/queueProcessors/inbox'
import { updateUserWorker } from './utils/queueProcessors/updateUser'
import { prepareSendRemotePostWorker } from './utils/queueProcessors/prepareSendRemotePost'
import { sendPostToInboxes } from './utils/queueProcessors/sendPostToInboxes'

console.log('starting workers')
const workerInbox = new Worker('inbox', (job: Job) => inboxWorker(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency
})

const workerUpdateRemoteUsers = new Worker('UpdateUsers', (job: Job) => updateUserWorker(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency
})

const worerPrepareSendPost = new Worker('prepareSendPost', (job: Job) => prepareSendRemotePostWorker(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency,
  lockDuration: 60000
})

const workerSendPostChunk = new Worker('sendPostToInboxes', (job: Job) => sendPostToInboxes(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency,
  lockDuration: 120000
})

workerInbox.on('completed', (job) => {
  // console.log(`${job.id} has completed!`)
})

workerInbox.on('failed', (job, err) => {
  console.warn(`${job?.id} has failed with ${err.message}`)
})

worerPrepareSendPost.on('completed', (job) => {
  // console.log(`${job.id} has completed!`)
})

worerPrepareSendPost.on('failed', (job, err) => {
  console.warn(`sending post ${job?.id} has failed with ${err.message}`)
})

workerUpdateRemoteUsers.on('failed', (job, err) => {
  console.warn(`update user ${job?.id} has failed with ${err.message}`)
})

workerUpdateRemoteUsers.on('completed', (job) => {
  //console.warn(`user ${job?.id} has been updated`)
})

workerSendPostChunk.on('completed', (job) => {
  //console.log(`${job.id} has completed!`)
})

workerSendPostChunk.on('failed', (job, err) => {
  console.warn(`sending post to some inboxes ${job?.id} has failed with ${err.message}`)
})