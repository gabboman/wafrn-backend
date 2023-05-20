import { Job, Worker } from 'bullmq'
import { logger } from './utils/logger'
import { environment } from './environment'
import { inboxWorker } from './utils/queueProcessors/inbox'

const worker = new Worker('inbox', (job: Job) => inboxWorker(job), {
  connection: environment.bullmqConnection,
  concurrency: environment.fediverseConcurrency
})
worker.on('completed', (job) => {
  console.log(`${job.id} has completed!`)
})

worker.on('failed', (job, err) => {
  console.warn(`${job?.id} has failed with ${err.message}`)
})
