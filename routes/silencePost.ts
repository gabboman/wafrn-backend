import { Application, Response } from 'express'
import { authenticateToken } from '../utils/authenticateToken'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import { getMutedPosts } from '../utils/cacheGetters/getMutedPosts'
import { getUnjointedPosts } from '../utils/baseQueryNew'
import { Post, SilencedPost } from '../db'
import { redisCache } from '../utils/redis'

export default function silencePostRoutes(app: Application) {
  app.get('/api/v2/silencedPosts', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId as string
    const silencedIds = await getMutedPosts(userId)
    res.send(await getUnjointedPosts(silencedIds, userId))
  })

  app.post('/api/v2/unsilencePost', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId as string
    const idPostToUnsilence = req.body.postId
    if (idPostToUnsilence) {
      await SilencedPost.destroy({
        where: {
          userId: userId,
          postId: idPostToUnsilence
        }
      })
      await redisCache.del('mutedPosts:' + userId)
      res.send({ success: true })
    } else {
      res.send({
        success: false
      })
    }
  })

  app.post('/api/v2/silencePost', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const userId = req.jwtData?.userId as string
    const idPostToUnsilence = req.body.postId

    if (idPostToUnsilence) {
      const postToSilence = await Post.findOne({
        where: {
          id: idPostToUnsilence,
          userId: userId
        }
      })
      if (postToSilence) {
        await SilencedPost.create({
          userId: userId,
          postId: idPostToUnsilence
        })
        await redisCache.del('mutedPosts:' + userId)
      }
      res.send({ success: true })
    } else {
      res.send({
        success: false
      })
    }
  })
}

export { silencePostRoutes }
