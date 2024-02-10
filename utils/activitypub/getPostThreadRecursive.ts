import { Op } from 'sequelize'
import {
  Blocks,
  Emoji,
  FederatedHost,
  Media,
  Post,
  PostMentionsUserRelation,
  ServerBlock,
  PostTag,
  User,
  sequelize
} from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getRemoteActor } from './getRemoteActor'
import { getPetitionSigned } from './getPetitionSigned'
import { fediverseTag } from '../../interfaces/fediverse/tags'
import { toHtml } from '@opera7133/mfmp'
import * as mfm from 'mfm-js'
import { loadPoll } from './loadPollFromPost'
async function getPostThreadRecursive(user: any, remotePostId: string, remotePostObject?: any) {
  try {
    remotePostId.startsWith(`${environment.frontendUrl}/fediverse/post/`)
  } catch (error) {
    logger.debug('HERE IS THE ISSUE')
    logger.debug(remotePostId)
  }
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
    const parentPostPetition = await getPetitionSigned(user, postInDatabase.remotePostId)
    if (parentPostPetition) {
      await loadPoll(parentPostPetition, postInDatabase, user)
    }
    return postInDatabase
  } else {
    try {
      const postPetition = remotePostObject ? remotePostObject : await getPetitionSigned(user, remotePostId)
      if (postPetition) {
        const remotePostInDatabase = await Post.findOne({
          where: {
            remotePostId: postPetition.id
          }
        })
        if (remotePostInDatabase) {
          const parentPostPetition = await getPetitionSigned(user, remotePostInDatabase.remotePostId)
          if (parentPostPetition) {
            await loadPoll(parentPostPetition, remotePostInDatabase, user)
          }
          return remotePostInDatabase
        }
      }
      const remoteUser = await getRemoteActor(postPetition.attributedTo, user)
      const remoteUserServerBaned = remoteUser.federatedHostId
        ? (await FederatedHost.findByPk(remoteUser.federatedHostId)).blocked
        : false
      const medias = []
      const fediTags: fediverseTag[] = [
        ...new Set<fediverseTag>(
          postPetition.tag
            ?.filter((elem: fediverseTag) => elem.type === 'Hashtag')
            .map((elem: fediverseTag) => {
              return { href: elem.href, type: elem.type, name: elem.name }
            })
        )
      ]
      let fediMentions: fediverseTag[] = postPetition.tag?.filter((elem: fediverseTag) => elem.type === 'Mention')
      if (fediMentions == undefined) {
        fediMentions = postPetition.to.map((elem: string) => {
          return { href: elem }
        })
      }
      const fediEmojis: any[] = postPetition.tag?.filter((elem: fediverseTag) => elem.type === 'Emoji')

      let privacy = 10
      if (postPetition.to.includes('https://www.w3.org/ns/activitystreams#Public')) {
        // post is PUBLIC
        privacy = 0
      }
      if (postPetition.cc.includes('https://www.w3.org/ns/activitystreams#Public')) {
        // unlisted
        privacy = 3
      }
      if (postPetition.to[0].toString().indexOf('followers') !== -1) {
        privacy = 1
      }

      let postTextContent =
        '' + postPetition.source?.mediaType === 'text/x.misskeymarkdown'
          ? toHtml(mfm.parse(postPetition.source.content))
          : postPetition.content
      if (postPetition.attachment && postPetition.attachment.length > 0 && !remoteUser.banned) {
        for await (const remoteFile of postPetition.attachment) {
          if (remoteFile.type !== 'Link') {
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
          } else {
            postTextContent = '' + postTextContent + `<a href="${remoteFile.href}" >${remoteFile.href}</a>`
          }
        }
      }

      const lemmyName = postPetition.name ? postPetition.name : ''
      postTextContent = postTextContent ? postTextContent : `<p>${lemmyName}</p>`
      const postToCreate: any = {
        content: '' + postTextContent,
        content_warning: postPetition.sensitive
          ? postPetition.summary
          : remoteUser.NSFW
          ? 'User is marked as NSFW by this instance staff. Possible NSFW without tagging'
          : '',
        createdAt: new Date(postPetition.published),
        updatedAt: new Date(postPetition.published),
        userId: remoteUser.id,
        remotePostId: postPetition.id,
        privacy: privacy
      }

      const mentionedUsersIds: string[] = []
      const tagsToAdd: any = []
      const emojis: any[] = []
      try {
        if (!remoteUser.banned && !remoteUserServerBaned) {
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
            if (mentionedUser?.id) {
              mentionedUsersIds.push(mentionedUser.id)
            }
          }
        }
      } catch (error) {
        logger.info('problem processing mentions')
        logger.info(error)
      }
      if (postPetition.inReplyTo) {
        const parent = await getPostThreadRecursive(user, postPetition.inReplyTo)
        postToCreate.parentId = parent?.id
        const newPost = await Post.create(postToCreate)
        await newPost.setParent(parent)
        try {
          if (!remoteUser.banned && !remoteUserServerBaned) {
            processEmojis(newPost, fediEmojis)
          }
        } catch (error) {
          logger.debug('Problem processing emojis')
        }
        newPost.addMedias(medias)
        await newPost.save()
        try {
          if (!remoteUser.banned && !remoteUserServerBaned) {
            await addTagsToPost(newPost.id, fediTags)
          }
        } catch (error) {
          logger.info('problem processing tags')
        }
        await processMentions(newPost, mentionedUsersIds)
        await loadPoll(remotePostObject, newPost, user)
        return newPost
      } else {
        const post = await Post.create(postToCreate)
        post.addMedias(medias)
        if (!remoteUser.banned && !remoteUserServerBaned) {
          await addTagsToPost(post.id, fediTags)
        }
        try {
          if (!remoteUser.banned && !remoteUserServerBaned) {
            processEmojis(post, fediEmojis)
          }
        } catch (error) {
          logger.debug('Problem processing emojis')
        }
        await processMentions(post, mentionedUsersIds)
        await loadPoll(remotePostObject, post, user)
        return post
      }
    } catch (error) {
      logger.trace({
        message: 'error getting remote post',
        url: remotePostId,
        user: user.url,
        problem: error
      })
      return null
    }
  }
}

async function addTagsToPost(postId: string, tags: fediverseTag[]) {
  return await PostTag.bulkCreate(
    tags.map((elem) => {
      return {
        tagName: elem.name.replace('#', ''),
        postId: postId
      }
    })
  )
}

async function processMentions(post: any, userIds: string[]) {
  const blocks = await Blocks.findAll({
    where: {
      blockerId: {
        [Op.in]: userIds
      },
      blockedId: post.userId
    }
  })
  const remoteUser = await User.findByPk(post.userId, { attributes: ['federatedHostId'] })
  const userServerBlocks = await ServerBlock.findAll({
    where: {
      userBlockerId: {
        [Op.in]: userIds
      },
      blockedServerId: remoteUser.federatedHostId
    }
  })
  const blockerIds: string[] = blocks
    .map((block: any) => block.blockerId)
    .concat(userServerBlocks.map((elem: any) => elem.userBlockerId))

  return await PostMentionsUserRelation.bulkCreate(
    userIds
      .filter((elem) => !blockerIds.includes(elem))
      .map((elem) => {
        return {
          postId: post.id,
          userId: elem
        }
      })
  )
}

async function processEmojis(post: any, fediEmojis: any[]) {
  const emojis: any[] = []
  if (fediEmojis) {
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
  }

  return post.addEmojis(emojis)
}

export { getPostThreadRecursive }
