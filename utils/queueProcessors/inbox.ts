import { Job } from 'bullmq'
import { logger } from '../logger'
import {
  Blocks,
  FederatedHost,
  Follows,
  Media,
  Post,
  ServerBlock,
  User,
  UserLikesPostRelations,
  sequelize
} from '../../db'
import { getRemoteActor } from '../activitypub/getRemoteActor'
import { signAndAccept } from '../activitypub/signAndAccept'
import { environment } from '../../environment'
import { removeUser } from '../activitypub/removeUser'
import { getPostThreadRecursive } from '../activitypub/getPostThreadRecursive'
import { Op, Sequelize } from 'sequelize'
import { loadPoll } from '../activitypub/loadPollFromPost'
import getPostBaseQuery from '../getPostBaseQuery'
import { redisCache } from '../redis'
import getBlockedIds from '../cacheGetters/getBlockedIds'
import getUserBlockedServers from '../cacheGetters/getUserBlockedServers'
import { object } from 'underscore'
import { getUserIdFromRemoteId } from '../cacheGetters/getUserIdFromRemoteId'

async function inboxWorker(job: Job) {
  try {
    const user = await User.findByPk(job.data.petitionBy)
    const body = job.data.petition
    const req = { body: body }
    const remoteUser = await getRemoteActor(req.body.actor, user)
    const host = await FederatedHost.findOne({
      where: {
        displayName: new URL(req.body.actor).host
      }
    })
    // we check if the user has blocked the user or the server. This will mostly work for follows and dms. Will investigate further down the line
    const userBlocks: string[] = await getBlockedIds(user.id, false)
    const blocksExisting = userBlocks.includes(remoteUser.id) ? 1 : 0
    const blockedServersData = await getUserBlockedServers(user.id)
    const blocksServers = blockedServersData.find((elem: any) => elem.id === host.id) ? 1 : 0
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
                redisCache.del('follows:full:' + followToUpdate.followerId)
              }
            }
          }
          break
        }
        case 'Announce': {
          // LEMMY HACK
          let urlToGet = typeof body.object === 'string' ? body.object : body.object.object
          urlToGet = typeof urlToGet === 'string' ? urlToGet : urlToGet.id
          // GOD LORD, THIS IS HERE JUST BECAUSE LEMMY.
          const retooted_content = await getPostThreadRecursive(user, urlToGet)
          let privacy = 10
          if (req.body.to.indexOf('https://www.w3.org/ns/activitystreams#Public') !== -1) {
            // post is PUBLIC
            privacy = 0
          }
          if (req.body.to[0].toString().indexOf('followers') !== -1) {
            privacy = 1
          }
          if (remoteUser.url !== environment.deletedUser && retooted_content) {
            const postToCreate = {
              content: '',
              content_warning: '',
              createdAt: new Date(),
              updatedAt: new Date(),
              userId: remoteUser.id,
              remotePostId: body.id,
              privacy: privacy,
              parentId: retooted_content.id
            }
            const newToot = await Post.create(postToCreate)
            await newToot.save()
            await signAndAccept({ body: body }, remoteUser, user)
          } else {
            if (!retooted_content) {
              logger.debug(`We could not get remote post to be retooted: ${body.object}`)
              logger.debug(body)
            }
          }
          break
        }
        case 'Create': {
          // Create new post
          const postRecived = body.object
          switch (postRecived.type) {
            case 'Note':
            case 'ChatMessage':
            case 'Question': {
              await getPostThreadRecursive(user, postRecived.id, postRecived)
              await signAndAccept({ body: body }, remoteUser, user)
              break
            }
            default:
              logger.info(`post type not implemented: ${postRecived.type}`)
          }
          break
        }
        case 'Follow': {
          // Follow user
          const userToBeFollowed = await getRemoteActor(req.body.object, user)
          let remoteFollow = await Follows.findOne({
            where: {
              followedId: remoteUser.id,
              followerId: userToBeFollowed.id
            }
          })
          if (!remoteFollow) {
            await Follows.create({
              followerId: remoteUser.id,
              followedId: userToBeFollowed.id,
              remoteFollowId: req.body.id,
              accepted: !userToBeFollowed.manuallyAcceptsFollows
            })
            await user.addFollower(remoteUser)
            remoteFollow = await Follows.findOne({
              where: {
                followerId: remoteUser.id,
                followedId: userToBeFollowed.id
              }
            })
          }
          remoteFollow.save()
          // we accept it
          const acceptResponse = await signAndAccept(req, remoteUser, user)
          break
        }
        case 'Update': {
          const body = req.body.object
          switch (body.type) {
            case 'Question': {
              await loadPoll(body, await getPostThreadRecursive(user, body.id), user)
            }
            // eslint-disable-next-line no-fallthrough
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
                  await postToEdit.setMedias(medias)
                }
              }
              const postUpdateTime = body.updated ? body.updated : new Date()
              postToEdit.content = `${body.content}<p>Post edited at ${postUpdateTime}</p>`
              postToEdit.updatedAt = postUpdateTime
              await postToEdit.save()
              await signAndAccept(req, remoteUser, user)
              break
            }
            case 'Person': {
              if (body.id) {
                getRemoteActor(body.id, user, 0, true)
                await signAndAccept(req, remoteUser, user)
              }
              break
            }
            default: {
              logger.info(`update not implemented ${body.type}`)
              logger.info(body)
            }
          }
          break
        }
        case 'Undo': {
          // Unfollow? Destroy post? what else can be undone

          const body = req.body
          switch (body.object.type) {
            case 'Follow': {
              const userToBeUnfollowed = await getRemoteActor(req.body.object, user)
              const remoteFollow = await Follows.findOne({
                where: {
                  // I think i was doing something wrong here. Changed so when remote unfollow does not cause you to unfollow them instead lol
                  followerId: remoteUser.id,
                  followedId: userToBeUnfollowed.id,
                  remoteFollowId: body.object.id
                }
              })
              if (remoteFollow) {
                await remoteFollow.destroy()
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
                const orphans = await Post.count({
                  where: {
                    parentId: postToDelete.id
                  }
                })
                if (orphans === 0) {
                  await postToDelete.destroy()
                } else {
                  // WAIT WHAT THIS SHOULD NOT BE POSSIBLE
                  logger.warn('We are trying to delete a retoot... with children. WHAT?')
                }
              }
              await signAndAccept(req, remoteUser, user)
              break
            }
            case 'Like': {
              const likeToRemove = await UserLikesPostRelations.findOne({
                where: {
                  remoteId: body.id
                }
              })
              if (likeToRemove) {
                likeToRemove.destroy()
              }
              break
            }
            default: {
              logger.info(`UNDO NOT IMPLEMENTED: ${body.object.type}`)
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
                      postToDelete.content = 'Post has been deleted in' + new Date().toString()
                      postToDelete.setMedias([])
                      postToDelete.setTags([])
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
          logger.info(req.body)
        }
      }
    }
  } catch (err) {
    logger.debug(err)
    const error = new Error('error')
  }
}

export { inboxWorker }
