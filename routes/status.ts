import { Application, Response } from 'express'
import { adminToken, authenticateToken } from '../utils/authenticateToken'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { Queue } from 'bullmq'
import { environment } from '../environment'

export default function statusRoutes(app: Application) {
  app.get('/api/status/workerStats', authenticateToken, adminToken, async (req: AuthorizedRequest, res: Response) => {
    const sendPostsQueue = new Queue('sendPostToInboxes', {
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
    const prepareSendPostQueue = new Queue('prepareSendPost', {
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
    const inboxQueue = new Queue('inbox', {
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
    const updateUsersQueue = new Queue('UpdateUsers', {
      connection: environment.bullmqConnection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 1000
      }
    })
    const sendPostFailed = sendPostsQueue.getMetrics('failed')
    const sendPostSuccess = sendPostsQueue.getMetrics('completed')
    const prepareSendPostFail = prepareSendPostQueue.getMetrics('failed')
    const prepareSendPostSuccess = prepareSendPostQueue.getMetrics('completed')
    const inboxFail = inboxQueue.getMetrics('failed')
    const inboxSuccess = inboxQueue.getMetrics('completed')
    const updateUserFail = updateUsersQueue.getMetrics('failed')
    const updateUserSuccess = updateUsersQueue.getMetrics('completed')

    await Promise.allSettled([
      sendPostFailed,
      sendPostSuccess,
      prepareSendPostFail,
      prepareSendPostSuccess,
      inboxFail,
      inboxSuccess,
      updateUserFail,
      updateUserSuccess
    ])

    res.send({
      sendPostFailed: await sendPostFailed,
      sendPostSuccess: await sendPostSuccess,
      prepareSendFail: await prepareSendPostFail,
      prepareSendSuccess: await prepareSendPostSuccess,
      inboxFail: await inboxFail,
      inboxSuccess: await inboxSuccess,
      updateUserFail: await updateUserFail,
      updateUserSuccess: await updateUserSuccess
    })
  })
}
