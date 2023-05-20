import { Job, Worker } from 'bullmq'
import { logger } from './utils/logger'
import { environment } from './environment'
import { inboxWorker } from './utils/queueProcessors/inbox'



const worker = new Worker('inbox', (job: Job) => inboxWorker(job) , {
  connection: environment.bullmqConnection,
  concurrency: 5
})
worker.on('completed', (job) => {
  logger.trace(`${job.id} has completed!`)
})

worker.on('failed', (job, err) => {
  logger.debug(`${job?.id} has failed with ${err.message}`)
})