import { Post, PostMentionsUserRelation, User } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'

async function removeUser(userId: string) {
  let deleted = false
  try {
    const userToRemove = await User.findOne({ where: { remoteId: userId } })
    if (userToRemove) {
      const ownerOfDeletedPost = await User.findOne({
        where: {
          url: environment.deletedUser
        }
      })
      userToRemove.activated = false
      Post.update(
        {
          userId: ownerOfDeletedPost.id,
          content: 'Post has been deleted because remote user has been deleted'
        },
        {
          where: {
            userId: userToRemove.id
          }
        }
      )
      await userToRemove.removeFollowers()
      await userToRemove.removeFolloweds()
      await PostMentionsUserRelation.update(
        {
          userId: ownerOfDeletedPost.id
        },
        {
          where: {
            userId: userToRemove.id
          }
        }
      )
      //await userToRemove.save()
      await userToRemove.destroy()
      deleted = true
    }
  } catch (error) {
    logger.debug({
      message: 'Error deleting user',
      error: error,
      userId: userId
    })
  }
  return deleted
}

export { removeUser }
