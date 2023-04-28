import { Op } from 'sequelize'
import { Media, Post, PostMentionsUserRelation, User, sequelize } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getRemoteActor } from './getRemoteActor'
import { getPetitionSigned } from './getPetitionSigned'

async function getPostThreadRecursive(user: any, remotePostId: string, remotePostObject?: any) {
  if (remotePostId.startsWith(`${environment.frontendUrl}/fediverse/post/`)) {
    // we are looking at a local post
    const partToRemove = `${environment.frontendUrl}/fediverse/post/`
    const postId = remotePostId.substring(partToRemove.length)
    return await Post.findOne({
      where: {
        id: postId
      }
    })
  }
  const postInDatabase = await Post.findOne({
    where: {
      remotePostId: remotePostId
    }
  })
  if (postInDatabase) {
    return postInDatabase
  } else {
    try {
      const postPetition = remotePostObject ? remotePostObject : await getPetitionSigned(user, remotePostId)

      const remoteUser = await getRemoteActor(postPetition.attributedTo, user)
      let mediasString = ''
      const medias = []
      const fediMentions = postPetition.tag
        .filter((elem: any) => elem.type === 'Mention')
        .filter((elem: any) => elem.href.startsWith(environment.frontendUrl))
      let privacy = 10
      if (postPetition.to.indexOf('https://www.w3.org/ns/activitystreams#Public') !== -1) {
        // post is PUBLIC
        privacy = 0
      }
      if (postPetition.to[0].toString().indexOf('followers') !== -1) {
        privacy = 1
      }

      if (postPetition.attachment && postPetition.attachment.length > 0) {
        for await (const remoteFile of postPetition.attachment) {
          const wafrnMedia = await Media.create({
            url: remoteFile.url,
            NSFW: remotePostObject?.sensitive,
            adultContent: !!remotePostObject?.sensitive,
            userId: remoteUser.id,
            description: remoteFile.name,
            ipUpload: 'IMAGE_FROM_OTHER_FEDIVERSE_INSTANCE',
            external: true
          })
          medias.push(wafrnMedia)
          mediasString = `${mediasString}[wafrnmediaid="${wafrnMedia.id}"]`
        }
      }
      const postToCreate = {
        content: postPetition.content + mediasString,
        content_warning: postPetition.sensitive
          ? postPetition.summary
          : remoteUser.NSFW
          ? 'User is marked as NSFW by this instance staff. Possible NSFW without tagging'
          : '',
        createdAt: new Date(postPetition.published),
        updatedAt: new Date(),
        userId: remoteUser.id,
        remotePostId,
        privacy: privacy
      }
      const mentionedUsersIds = []
      try {
        for await (const mention of fediMentions) {
          const username = mention.href.substring(`${environment.frontendUrl}/fediverse/blog/`.length)
          const mentionedUser = await User.findOne({
            where: {
              [Op.or]: [
                sequelize.where(
                  sequelize.fn('LOWER', sequelize.col('url')),
                  'LIKE',
                  // TODO fix
                  username.toLowerCase()
                )
              ]
            }
          })
          mentionedUsersIds.push(mentionedUser.id)
        }
      } catch (error) {
        logger.info('problem processing mentions')
      }
      if (postPetition.inReplyTo) {
        const parent = await getPostThreadRecursive(user, postPetition.inReplyTo)
        const newPost = await Post.create(postToCreate)
        await newPost.setParent(parent)
        await newPost.save()
        newPost.addMedias(medias)
        for await (const mention of mentionedUsersIds) {
          PostMentionsUserRelation.create({
            userId: mention,
            postId: newPost.id
          })
        }
        return newPost
      } else {
        const post = await Post.create(postToCreate)
        post.addMedias(medias)
        for await (const mention of mentionedUsersIds) {
          PostMentionsUserRelation.create({
            userId: mention,
            postId: post.id
          })
        }
        return post
      }
    } catch (error) {
      logger.info({
        message: 'error getting remote post',
        url: remotePostId,
        user: user.url,
        error: error
      })
      return null
    }
  }
}

export { getPostThreadRecursive }
