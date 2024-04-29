import { Application, Response } from "express"
import { authenticateToken } from "../utils/authenticateToken"
import AuthorizedRequest from "../interfaces/authorizedRequest"
import { Emoji, EmojiReaction, Post, User } from "../db"
import { logger } from "../utils/logger"
import { emojiReactRemote } from "../utils/activitypub/likePost"

export default function emojiReactRoutes(app: Application) {
    app.post('/api/emojiReact', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
      let success = false
      const userId = req.jwtData?.userId
      const postId = req.body.postId
      const emojiId = req.body.emojiId
  
      const user = User.findByPk(userId)
      const post = Post.findByPk(postId)
      const emoji = Emoji.findByPk(emojiId)
      const existing = EmojiReaction.findOne({
        where: {
            userId: userId,
            postId: postId,
            emojiId: emojiId
        }
      })
      try {
        await Promise.all([user, post, emoji, existing])
        if ((await user) && (await post) && !(await existing)) {
          const reaction = await EmojiReaction.create({
            userId: userId,
            postId: postId,
            emojiId: emojiId,
            content: (await emoji).name
          })
          await reaction.save()
          success = true
          emojiReactRemote(reaction)
        }
        if (await existing) {
          success = true
        }
      } catch (error) {
        logger.debug(error)
      }
      res.send({ success: success })
    })



}

export {emojiReactRoutes}