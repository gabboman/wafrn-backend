import { Job } from 'bullmq'
import { logger } from '../logger'
import { Blocks, FederatedHost, Follows, Media, Post, ServerBlock, User, UserLikesPostRelations } from '../../db'
import { getRemoteActor } from '../activitypub/getRemoteActor'
import { signAndAccept } from '../activitypub/signAndAccept'
import { environment } from '../../environment'
import { removeUser } from '../activitypub/removeUser'
import { getPostThreadRecursive } from '../activitypub/getPostThreadRecursive'
import { Op, Sequelize } from 'sequelize'

async function inboxWorker(job: Job) {
  try {
    const user = await User.findOne({
      where: {
        id: job.data.petitionBy
      }
    })
    const body = job.data.petition
    const req = { body: body }
    const remoteUser = await getRemoteActor(req.body.actor, user)
    const host = await FederatedHost.findOne({
      where: {
        displayName: new URL(req.body.actor).host
      }
    })
    // we check if the user has blocked the user or the server. This will mostly work for follows and dms. Will investigate further down the line
    const blocksExisting = await Blocks.count({
      where: {
        [Op.or]: [
          {
            blockerId: user.id,
            blockedId: remoteUser.id
          },
          {
            blockedId: user.id,
            blockerId: remoteUser.id
          }
        ]
      }
    })
    const blocksServers = await ServerBlock.count({
      where: {
        blockedServerId: host.id,
        userBlockerId: user.id
      }
    })
    if (!remoteUser?.banned && !host?.blocked && blocksExisting + blocksServers === 0) {
      switch (req.body.type) {
        case 'Accept': {
          if (req.body.object.type === 'Follow' && req.body.object.id.startsWith(environment.frontendUrl)) {
            const followUrl = req.body.object.id
            const partToRemove = `${environment.frontendUrl}/fediverse/follows/`
            const follows = followUrl.substring(partToRemove.length).split('/')
            if (follows.length === 2) {
              const followToUpdate = await Follows.findOne({
                where: {
                  followerId: follows[0],
                  followedId: follows[1]
                }
              })
              if (followToUpdate) {
                followToUpdate.accepted = true
                await followToUpdate.save()
              }
            }
          }
          break
        }
        case 'Announce': {
          const retooted_content = await getPostThreadRecursive(user, body.object)
          let privacy = 10
          if (req.body.to.indexOf('https://www.w3.org/ns/activitystreams#Public') !== -1) {
            // post is PUBLIC
            privacy = 0
          }
          if (req.body.to[0].toString().indexOf('followers') !== -1) {
            privacy = 1
          }
          if (remoteUser.url !== environment.deletedUser) {
            const postToCreate = {
              content: '',
              content_warning: '',
              createdAt: new Date(),
              updatedAt: new Date(),
              userId: remoteUser.id,
              remotePostId: body.id,
              privacy: privacy
            }
            const newToot = await Post.create(postToCreate)
            await newToot.setParent(retooted_content)
            await newToot.save()
            await signAndAccept({ body: body }, remoteUser, user)
          }
          break
        }
        case 'Create': {
          // Create new post
          const postRecived = body.object
          if (postRecived.type === 'Note' || postRecived.type === 'ChatMessage') {
            await getPostThreadRecursive(user, postRecived.id, postRecived)
            await signAndAccept({ body: body }, remoteUser, user)
          } else {
            logger.info(`post type not implemented: ${postRecived.type}`)
          }
          break
        }
        case 'Follow': {
          // Follow user
          let remoteFollow = await Follows.findOne({
            where: {
              followedId: remoteUser.id,
              followerId: user.id
            }
          })
          if (!remoteFollow) {
            await Follows.create({
              followerId: remoteUser.id,
              followedId: user.id,
              remoteFollowId: req.body.id,
              accepted: !user.manuallyAcceptsFollows
            })
            await user.addFollower(remoteUser)
            remoteFollow = await Follows.findOne({
              where: {
                followerId: remoteUser.id,
                followedId: user.id
              }
            })
          }
          remoteFollow.save()
          // we accept it
          const acceptResponse = await signAndAccept(req, remoteUser, user)
          logger.debug(`Remote user ${remoteUser.url} started following ${user.url}`)
          break
        }
        case 'Update': {
          const body = req.body.object
          switch (body.type) {
            case 'Note': {
              const postToEdit = await Post.findOne({
                where: {
                  remotePostId: body.id
                },
                include: [
                  {
                    model: Media,
                    attributes: ['id']
                  }
                ]
              })
              let mediasString = ''
              const medias = []
              if (body.attachment && body.attachment.length > 0) {
                for await (const remoteFile of body.attachment) {
                  const wafrnMedia = await Media.create({
                    url: remoteFile.url,
                    NSFW: body?.sensitive,
                    adultContent: !!body?.sensitive,
                    userId: remoteUser.id,
                    description: remoteFile.name,
                    ipUpload: 'IMAGE_FROM_OTHER_FEDIVERSE_INSTANCE',
                    external: true
                  })
                  medias.push(wafrnMedia)
                  mediasString = `${mediasString}[wafrnmediaid="${wafrnMedia.id}"]`
                  await postToEdit.removeMedias()
                  await postToEdit.addMedias(medias)
                }
              }
              postToEdit.content = `${body.content}<p>${mediasString}<p>Post edited at ${body.updated}</p>`
              postToEdit.updatedAt = body.updated
              await postToEdit.save()
              const acceptResponse = await signAndAccept(req, remoteUser, user)
              break
            }
            default: {
              logger.info(`update not implemented ${body.type}`)
              logger.info(body.object)
            }
          }
          break
        }
        case 'Undo': {
          // Unfollow? Destroy post? what else can be undone

          const body = req.body
          switch (body.object.type) {
            case 'Follow': {
              const remoteFollow = await Follows.findOne({
                where: {
                  // I think i was doing something wrong here. Changed so when remote unfollow does not cause you to unfollow them instead lol
                  followerId: remoteUser.id,
                  followedId: user.id,
                  remoteFollowId: body.object.id
                }
              })
              if (remoteFollow) {
                await remoteFollow.destroy()
                logger.debug(`Remote unfollow ${remoteUser.url} unfollowed ${user.url}`)
              }
              await signAndAccept(req, remoteUser, user)
              break
            }
            case 'Undo': {
              // just undo? Might be like might be something else.
              const likeToRemove = await UserLikesPostRelations.findOne({
                where: {
                  remoteId: req.body.object.id
                }
              })
              if (likeToRemove) {
                await likeToRemove.destroy()
              }
              break
            }
            case 'Announce': {
              const postToDelete = await Post.findOne({
                where: {
                  remotePostId: req.body.object.id
                }
              })
              if (postToDelete) {
                const orphans = await postToDelete.getChildren({
                  where: {
                    hierarchyLevel: postToDelete.hierarchyLevel + 1
                  }
                })
                for (const orphan of orphans) {
                  orphan.parentId = postToDelete.parentId
                  await orphan.save()
                }
                await postToDelete.destroy()
              }
              await signAndAccept(req, remoteUser, user)
              break
            }
            default: {
              logger.info(`UNDO NOT IMPLEMENTED: ${req.body.type}`)
              logger.info(req.body)
            }
          }
          break
        }
        case 'Like': {
          const fullUrlPostToBeLiked = req.body.object
          const partToRemove = `${environment.frontendUrl}/fediverse/post/`
          const localPost = await Post.findOne({
            where: {
              id: fullUrlPostToBeLiked.substring(partToRemove.length)
            }
          })
          if (localPost && req.body.object.startsWith(environment.frontendUrl)) {
            const like = await UserLikesPostRelations.create({
              userId: remoteUser.id,
              postId: localPost.id,
              remoteId: req.body.id
            })
            await signAndAccept(req, remoteUser, user)
          }
          break
        }
        case 'Delete': {
          const body = req.body.object
          try {
            if (typeof body === 'string') {
              // we assume its just the url of an user
              await removeUser(req.body.object)
              await signAndAccept(req, remoteUser, user)
              break
            } else {
              switch (body.type) {
                case 'Tombstone': {
                  const postToDelete = await Post.findOne({
                    where: {
                      remotePostId: body.id
                    }
                  })
                  if (postToDelete) {
                    const children = await postToDelete.getChildren()
                    if (children && children.length > 0) {
                      postToDelete.content = 'Post has been deleted'
                      await postToDelete.save()
                    } else {
                      await postToDelete.destroy()
                    }
                  }
                  await signAndAccept(req, remoteUser, user)
                  break
                }
                default:
                  {
                    logger.info(`DELETE not implemented ${body.type}`)
                    logger.info(body)
                  }
                  break
              }
            }
          } catch (error) {
            logger.trace({
              message: 'error with delete petition',
              error: error,
              petition: req.body
            })
          }
          break
        }
        default: {
          logger.info(`NOT IMPLEMENTED: ${req.body.type}`)
          logger.info(req.body.object)
        }
      }
    } else {
      logger.debug(`Ignoring petition from ${host.displayName}: ${remoteUser.url} to ${user.url}`)
    }
  } catch (err) {
    logger.trace(err)
    const error = new Error('error')
  }
}

export { inboxWorker }
