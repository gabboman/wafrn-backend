import { Op } from 'sequelize'
import { Emoji, Media, Post, PostMentionsUserRelation, Tag, User, sequelize } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getRemoteActor } from './getRemoteActor'
import { getPetitionSigned } from './getPetitionSigned'
import { fediverseTag } from '../../interfaces/fediverse/tags'

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
      const fediTags: fediverseTag[] = [
        ...new Set<fediverseTag>(
          postPetition.tag
            .filter((elem: fediverseTag) => elem.type === 'Hashtag')
            .map((elem: fediverseTag) => {
              return { href: elem.href.toLocaleLowerCase(), type: elem.type, name: elem.name.toLowerCase() }
            })
        )
      ]
      const fediMentions: fediverseTag[] = postPetition.tag.filter((elem: fediverseTag) => elem.type === 'Mention')
      const fediEmojis: any[] = postPetition.tag.filter((elem: fediverseTag) => elem.type === 'Emoji')

      let privacy = 10
      if (postPetition.to.includes('https://www.w3.org/ns/activitystreams#Public')) {
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
            NSFW: postPetition?.sensitive,
            adultContent: !!postPetition?.sensitive,
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
        content: '' + postPetition.content + mediasString,
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
      const tagsToAdd: any = []
      const emojis: any[] = []
      for await (const emoji of fediEmojis) {
        let emojiToAdd = await Emoji.findByPk(emoji.id)
        if (emojiToAdd && new Date(emojiToAdd.updatedAt).getTime() < new Date(emoji.updated).getTime()) {
          emojiToAdd.name = emoji.name
          emojiToAdd.updatedAt = new Date()
          emojiToAdd.url = emoji.icon.url
          await emojiToAdd.save()
        }
        if (!emojiToAdd) {
          emojiToAdd = await Emoji.create({
            id: emoji.id,
            name: emoji.name,
            url: emoji.icon.url,
            external: true
          })
        }
        emojis.push(emojiToAdd)
      }
      try {
        for await (const mention of fediMentions) {
          let mentionedUser
          if (mention.href.indexOf(environment.frontendUrl) !== -1) {
            const username = mention.href.substring(`${environment.frontendUrl}/fediverse/blog/`.length)
            mentionedUser = await User.findOne({
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
          } else {
            mentionedUser = await getRemoteActor(mention.href, user)
          }

          mentionedUsersIds.push(mentionedUser.id)
        }
      } catch (error) {
        logger.info('problem processing mentions')
      }
      try {
        for await (const federatedTag of fediTags) {
          // remove #
          const tagToAdd = federatedTag.name.substring(1)
          const existingTag = await Tag.findOne({
            where: {
              tagName: tagToAdd
            }
          })
          if (existingTag) {
            tagsToAdd.push(existingTag)
          } else if (!existingTag) {
            const newTag = await Tag.create({
              tagName: tagToAdd
            })
            // we check that we dont add the same tag twice
            const tmpTags: string[] = tagsToAdd.map((elem: any) => elem.tagName)
            if (!tmpTags.includes(tagToAdd)) {
              tagsToAdd.push(newTag)
            }
          }
        }
      } catch (error) {
        logger.info('problem processing tags')
      }
      if (postPetition.inReplyTo) {
        const parent = await getPostThreadRecursive(user, postPetition.inReplyTo)
        const newPost = await Post.create(postToCreate)
        await newPost.setParent(parent)
        await newPost.save()
        newPost.addMedias(medias)
        newPost.addEmojis(emojis)
        tagsToAdd.forEach(async (tag: any) => {
          try {
            await newPost.addTag(tag)
          } catch (error) {
            logger.debug('error procesing tag')
          }
        })

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
        post.addTags(tagsToAdd)
        post.addEmojis(emojis)
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
