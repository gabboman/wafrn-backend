import { Op } from 'sequelize'
import { Post, User } from '../../db'
import { environment } from '../../environment'
import { fediverseTag } from '../../interfaces/fediverse/tags'
import { activityPubObject } from '../../interfaces/fediverse/activityPubObject'

async function postToJSONLD(post: any) {
  const localUser = await User.findOne({
    where: {
      id: post.userId
    }
  })
  const stringMyFollowers = `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}/followers`
  const dbMentions = await post.getMentionPost()
  let mentionedUsers: string[] = []

  if (dbMentions) {
    mentionedUsers = dbMentions.filter((elem: any) => elem.remoteInbox).map((elem: any) => elem.remoteId)
  }
  let parentPostString = null
  const conversationString = `${environment.frontendUrl}/fediverse/conversation/${post.id}`
  if (post.parentId) {
    let dbPost = await Post.findOne({
      where: {
        id: post.parentId
      }
    })
    while (dbPost.content === '' && dbPost.hierarchyLevel !== 0) {
      // TODO optimize this
      const tmpPost = await dbPost.getParent()
      dbPost = tmpPost
    }
    parentPostString = dbPost.remotePostId
      ? dbPost.remotePostId
      : `${environment.frontendUrl}/fediverse/post/${dbPost.id}`
  }
  const postMedias = await post.getMedias()
  let processedContent = post.content
  const wafrnMediaRegex =
    /\[wafrnmediaid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm
  const mentionRegex =
    /\[mentionuserid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm
  const uuidRegex = /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/

  // we remove the wafrnmedia from the post for the outside world, as they get this on the attachments
  processedContent = processedContent.replace(wafrnMediaRegex, '')
  const mentions = processedContent.matchAll(mentionRegex)
  const fediMentions: fediverseTag[] = []
  const fediTags: fediverseTag[] = []
  let finalTags = '<br>'
  for await (const tag of await post.getTags()) {
    const externalTagName = tag.tagName.replaceAll(' ', '-').replaceAll('"', "'")
    const link = `${environment.frontendUrl}/dashboard/search/${encodeURIComponent(tag.tagName)}`
    finalTags = `${finalTags}  <a class="hashtag" data-tag="post" href="${link}" rel="tag ugc">#${externalTagName}</a>`
    fediTags.push({
      type: 'Hashtag',
      name: `#${externalTagName}`,
      href: link
    })
  }
  for await (const mention of mentions) {
    const userId = mention[0].match(uuidRegex)[0]
    const user =
      (await User.findOne({ where: { id: userId } })) ||
      (await User.findOne({ where: { url: environment.deletedUser } }))
    processedContent = processedContent.replace(
      mention,
      `<span class="h-card"><a class="u-url mention" rel="ugc" href="${
        user.remoteId ? user.remoteId : `${environment.frontendUrl}/fediverse/blog/${user.url}`
      }" >@<span>${user.url.startsWith('@') ? user.url.substring(1) : user.url}</span></a></span>`
    )
    fediMentions.push({
      type: 'Mention',
      name: user.url.startsWith('@') ? user.url.substring(1) : user.url,
      href: user.remoteId ? user.remoteId : `${environment.frontendUrl}/blog/${user.url}`
    })
  }

  let contentWarning = false
  postMedias.forEach((media: any) => {
    if (media.NSFW) {
      contentWarning = true
    }
  })

  let postAsJSONLD: activityPubObject = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      {
        ostatus: 'http://ostatus.org#',
        atomUri: 'ostatus:atomUri',
        inReplyToAtomUri: 'ostatus:inReplyToAtomUri',
        conversation: 'ostatus:conversation',
        sensitive: 'as:sensitive',
        toot: 'http://joinmastodon.org/ns#',
        votersCount: 'toot:votersCount',
        blurhash: 'toot:blurhash',
        focalPoint: {
          '@container': '@list',
          '@id': 'toot:focalPoint'
        }
      }
    ],
    id: `${environment.frontendUrl}/fediverse/activity/post/${post.id}`,
    type: 'Create',
    actor: `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}`,
    published: post.createdAt.toISOString(),
    to:
      post.privacy / 1 === 10
        ? mentionedUsers
        : post.privacy / 1 === 0
        ? ['https://www.w3.org/ns/activitystreams#Public', stringMyFollowers]
        : [stringMyFollowers],
    cc: post.privacy / 1 === 0 ? [...mentionedUsers] : [],
    object: {
      id: `${environment.frontendUrl}/fediverse/post/${post.id}`,
      type: 'Note',
      summary: post.content_warning ? post.content_warning : '',
      inReplyTo: parentPostString,
      published: post.createdAt.toISOString(),
      url: `${environment.frontendUrl}/fediverse/post/${post.id}`,
      attributedTo: `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}`,
      to:
        post.privacy / 1 === 10
          ? mentionedUsers
          : post.privacy / 1 === 0
          ? ['https://www.w3.org/ns/activitystreams#Public', stringMyFollowers]
          : [stringMyFollowers],
      cc: post.privacy / 1 === 0 ? [...mentionedUsers] : [],
      sensitive: !!post.content_warning || contentWarning,
      atomUri: `${environment.frontendUrl}/fediverse/post/${post.id}`,
      inReplyToAtomUri: parentPostString,
      // conversation: conversationString,
      content: processedContent + finalTags,
      attachment: postMedias.map((media: any) => {
        const extension = media.url.split('.')[media.url.split('.').length - 1].toLowerCase()
        return {
          type: 'Document',
          mediaType: extension === 'mp4' ? 'video/mp4' : 'image/webp',
          url: environment.mediaUrl + media.url,
          sensitive: media.NSFW ? `Marked as NSFW: ${media.description}` : '',
          name: media.description
        }
      }),
      tag: fediMentions.concat(fediTags)
      /*
      replies: {
        id: `${environment.frontendUrl}/fediverse/post/${post.id}/replies`,
        type: 'Collection',
        first: {
          type: 'CollectionPage',
          next: `${environment.frontendUrl}/fediverse/post/${post.id}/replies&page=true`,
          partOf: `${environment.frontendUrl}/fediverse/post/${post.id}/replies`,
          items: []
        }
      }
      */
    }
  }
  if (post.content === '' && (await post.getTags()).length === 0) {
    postAsJSONLD = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${environment.frontendUrl}/fediverse/post/${post.id}`,
      type: 'Announce',
      actor: `${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}`,
      published: post.createdAt.toISOString(),
      to:
        post.privacy / 1 === 10
          ? mentionedUsers
          : post.privacy / 1 === 0
          ? ['https://www.w3.org/ns/activitystreams#Public']
          : [stringMyFollowers],
      cc: [`${environment.frontendUrl}/fediverse/blog/${localUser.url.toLowerCase()}`, stringMyFollowers],
      object: parentPostString
    }
  }
  return postAsJSONLD
}

export { postToJSONLD }
