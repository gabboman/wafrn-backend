import axios from 'axios'
import { Application } from 'express'
import { User, FederatedHost, Follows, Post, Media } from '../models'
import checkFediverseSignature from '../utils/checkFediverseSignature'
import { createHash, createSign } from 'crypto'
import sequelize from '../db'
import { resolve } from 'path'

var https = require('https');
var httpSignature = require('@peertube/http-signature');

const environment = require('../environment')

// all the stuff related to activitypub goes here

function activityPubRoutes (app: Application) {
  // webfinger protocol
  app.get('/.well-known/host-meta', (req: any, res) => {
    res.send(
      '<?xml version="1.0" encoding="UTF-8"?><XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0"><Link rel="lrdd" template="' + environment.frontendUrl + '/.well-known/webfinger?resource={uri}"/></XRD>'
    )
  })
  app.get('/.well-known/webfinger/', async (req: any, res) => {
    if (req.query && req.query.resource) {
      const urlQueryResource: string = req.query.resource
      if (urlQueryResource.startsWith('acct:') && urlQueryResource.endsWith(environment.instanceUrl)) {
        const userUrl = urlQueryResource.slice(5).slice(0, -(environment.instanceUrl.length + 1))
        const user = await User.findOne({
          where: sequelize.where(
            sequelize.fn('LOWER', sequelize.col('url')),
            'LIKE',
            userUrl.toLowerCase()
          )
        })
        if (!user) {
          return404(res)
          return
        }
        const response = {
          subject: urlQueryResource,
          aliases: [
            environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase(),
            environment.frontendUrl + '/blog/' + user.url.toLowerCase()
          ],
          links: [
            {
              rel: 'self',
              type: 'application/activity+json',
              href: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase()
            },
            {
              rel: 'http://ostatus.org/schema/1.0/subscribe',
              template: environment.frontendUrl + '/fediverse/authorize_interaction?uri={uri}'
            }
          ]
        }
        res.send(
          response
        )
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
  })

  // Get blog for fediverse
  app.get('/fediverse/blog/:url', async (req: any, res) => {
    if (req.params && req.params.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('url')),
          'LIKE',
          url
        )
      })
      if (user) {
        const userForFediverse = {
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            'https://w3id.org/security/v1'
          ],
          id: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase(),
          type: 'Person',
          following: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/following',
          followers: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/followers',
          featured: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/featured',
          inbox: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/inbox',
          outbox: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/outbox',
          preferredUsername: user.url.toLowerCase(),
          name: user.url,
          summary: user.description,
          url: environment.frontendUrl + '/blog/' + user.url.toLowerCase(),
          manuallyApprovesFollowers: false,
          discoverable: true,
          published: user.createdAt,
          icon: {
            type: 'Image',
            mediaType: 'image/webp',
            url: environment.mediaUrl + user.avatar
          },
          image: {
            type: 'Image',
            mediaType: 'image/webp',
            url: environment.mediaUrl + user.avatar
          },
          publicKey: {
            id: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '#main-key',
            owner: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase(),
            publicKeyPem: user.publicKey
          }
        }

        res.set({
          'content-type': 'application/activity+json'
        }).send(userForFediverse)
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
  })

  app.get('/fediverse/blog/:url/following', async (req: any, res) => {
    if (req.params && req.params.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('url')),
          'LIKE',
          url.toLowerCase()
        )
      })
      if (user) {
        const followed = await user.getFollowed()
        let response: any = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/following',
          type: 'OrderedCollection',
          totalItems: followed.length,
          first: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/following?page=1'
        }
        if (req.query && req.query.page) {
          response = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            id: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/following',
            type: 'OrderedCollection',
            totalItems: followed.length,
            partOf: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/following',
            orderedItems: followed.map(
              (elem: any) => elem.remoteId ? elem.remoteId : environment.frontendUrl + '/fediverse/blog/' + elem.url
            )
          }
        }
        res.send(response)
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
  }
  )

  app.get('/fediverse/blog/:url/followers', async (req: any, res) => {
    if (req.params && req.params.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('url')),
          'LIKE',
          url.toLowerCase()
        )
      })
      if (user) {
        const followers = await user.getFollower()
        let response: any = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/followers',
          type: 'OrderedCollection',
          totalItems: followers.length,
          first: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/followers?page=1'
        }
        if (req.query && req.query.page) {
          response = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            id: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/followers',
            type: 'OrderedCollection',
            totalItems: followers.length,
            partOf: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase() + '/followers',
            orderedItems: followers.map(
              (elem: any) => elem.remoteId ? elem.remoteId : environment.frontendUrl + '/fediverse/blog/' + elem.url
            )
          }
        }
        res.send(response)
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
  }
  )

  app.get('/fediverse/blog/:url/featured', async (req: any, res) => {
    return404(res)
  })

  app.post('/fediverse/blog/:url/inbox', checkFediverseSignature, async (req: any, res) => {
    if (req.params && req.params.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('url')),
          'LIKE',
          url.toLowerCase()
        )
      })
      if (user) {
        try {
          const remoteUser = await getRemoteActor(req.body.actor, user)
          switch (req.body.type) {
            case 'Create': {
              res.sendStatus(200)
              // Create new post
              const postRecived = req.body.object
              await getPostThreadRecursive(user, postRecived.id, postRecived)
              await signAndAccept(req, remoteUser, user)
              break
            }
            case 'Follow': {
              // Follow user
              res.sendStatus(200)
              let remoteFollow = await Follows.findOne({
                where: {
                  followerId: remoteUser.id,
                  followedId: user.id
                }
              })
              if (!remoteFollow) {
                await user.addFollower(remoteUser)
                await user.save()
                remoteFollow = await Follows.findOne({
                  where: {
                    followerId: remoteUser.id,
                    followedId: user.id
                  }
                })
              }

              remoteFollow.remoteFollowId = req.body.id
              remoteFollow.save()
              // we accept it
              const acceptResponse = await signAndAccept(req, remoteUser, user)
              break
            }
            case 'Undo': {
              // Unfollow? Destroy post? what else can be undone

              res.sendStatus(200)
              const body = req.body
              switch (body.object.type) {
                case 'Follow': {
                  const remoteFollow = await Follows.findOne({
                    where: {
                      followerId: remoteUser.id,
                      followedId: user.id,
                      remoteFollowId: body.object.id
                    }
                  })
                  if(remoteFollow) {
                    await remoteFollow.destroy()
                  }
                  await signAndAccept(req, remoteUser, user)
                }
                case 'Create': {
                  // TODO what if user wants to remove post? time to carl the delete I guess
                }
                default: {

                }
              }
              break
            }
            default: {
              res.sendStatus(200)
            }
          }
        } catch (error) {
          console.error(error)
          // res.send(500)
        }
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
  })

  app.post('/fediverse/inbox', async (req: any, res) => {

  })

  app.get('/fediverse/blog/:url/outbox', async (req: any, res) => {
    if (req.params && req.params.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.findOne({
        where: {
          url
        }
      })
      if (user) {

      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
  })
}

function return404 (res: any) {
  res.sendStatus(404)
}

async function getRemoteActor (actorUrl: string, user: any) {
  const url = new URL(actorUrl)

  // TODO properly sign petition
  const userPetition = await  signedGetPetition(user, actorUrl)

  let remoteUser = await User.findOne({
    where: {
      url: '@' + userPetition.preferredUsername + '@' + url.host
    }
  })

  if (!remoteUser) {
    const userToCreate = {
      url: '@' + userPetition.preferredUsername + '@' + url.host,
      email: null,
      description: userPetition.summary,
      avatar: userPetition.icon?.url ? userPetition.icon.url : '/uploads/default.webp',
      password: 'NOT_A_WAFRN_USER_NOT_REAL_PASSWORD',
      publicKey: userPetition.publicKey?.publicKeyPem,
      remoteInbox: userPetition.inbox,
      remoteId: actorUrl
    }
    remoteUser = await User.create(userToCreate)

    let federatedHost = await FederatedHost.findOne({
      where: {
        displayName: url.host.toLocaleLowerCase()
      }
    })
    if (!federatedHost) {
      const federatedHostToCreate = {
        displayName: url.host,
        publicInbox: userPetition.endpoints?.sharedInbox
      }
      federatedHost = await FederatedHost.create(federatedHostToCreate)
    }

    await federatedHost.addUser(remoteUser)
  }

  return remoteUser
}

function postPetitionSigned (message: object, user: any, target: string): Promise<any> {
  const res =  new Promise((resolve: any, reject: any) => {
    const url = new URL(target)
    const privKey = user.privateKey
    const messageToSend = JSON.stringify(message)
    const options = {
      host: url.host,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/activity+json',
        Accept: 'application/activity+json',
        digest: createHash('sha256').update(messageToSend).digest('base64')

      }
    };
    const httpPetition = https.request(options, (response:any)=> {
      
      let data = ''
      response.on('data', (chunk: any) => {
        data = data + chunk
      })
      if(response.statusCode.toString().startsWith('2')){

        response.on('end', () => {
          console.log('http post request to ' + url.href +' success by user ' +user.url)
          resolve({response: response, data: data})
        })
      } else {
        reject({'code_post': response.statusCode,'url': url.href, 'initiatedBy': user.url})
      }
    })
    httpSignature.signRequest(httpPetition, {
      key: privKey,
      keyId: `${environment.frontendUrl}/fediverse/blog/${user.url.toLocaleLowerCase()}#main-key`,
      algorithm: 'rsa-sha256',
      authorizationHeaderName: 'signature',
      headers: ['(request-target)', 'host', 'date', 'digest' ]
    });
    httpPetition.write(messageToSend)
    console.log('http post request to ' + url.href +' initiated by user ' +user.url)
    httpPetition.end();
  })
  return res
}

function signedGetPetition (user: any, target: string): Promise<any> {
  const res =  new Promise((resolve: any, reject: any) => {
    const url = new URL(target)
    const privKey = user.privateKey
    const options = {
      host: url.host,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        //'Content-Type': 'application/activity+json',
        Accept: 'application/activity+json',
      }
    };
    const httpPetition = https.request(options, (response:any)=> {
      if(response.statusCode == 200){
        let data = ''
        response.on('data', (chunk: any) => data = data + chunk)
        response.on('end', () => {
          console.log('http get request to ' + url.href + ' has finished successfully, initiated by user ' + user.url)
          resolve(JSON.parse(data))
        })
      } else {
        reject({'code_get': response.statusCode, 'url': url.href, 'initiatedBy': user.url})
      }
    })
    httpSignature.signRequest(httpPetition, {
      key: privKey,
      keyId: `${environment.frontendUrl}/fediverse/blog/${user.url.toLocaleLowerCase()}#main-key`,
      algorithm: 'rsa-sha256',
      authorizationHeaderName: 'signature',
      headers: ['(request-target)', 'host', 'date', 'accept' ]
    });
    console.log('http get request to ' + url.href + ' initiated by user ' + user.url)
    httpPetition.end();
  })
  return res
}

async function signAndAccept (req: any, remoteUser: any, user: any) {
  const acceptMessage = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: req.body.id,
    type: 'Accept',
    actor: environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase(),
    object: req.body
  }
  return await postPetitionSigned(acceptMessage, user, remoteUser.remoteInbox)
}

async function getPostThreadRecursive (user: any, remotePostId: string, remotePostObject?: any) {
  const postInDatabase = await Post.findOne({
    where: {
      remotePostId
    }
  })
  if (postInDatabase) {
    return postInDatabase
  } else {
    // TODO properly sign petition
    const postPetition = remotePostObject ? remotePostObject : await signedGetPetition(user, remotePostId)

    const remoteUser = await getRemoteActor(postPetition.attributedTo, user)
    let mediasString = ''
    const medias = []
    let privacy = 10
    
    if(postPetition.attachment && postPetition.attachment.length > 0) {
      for await (const remoteFile of postPetition.attachment) {
        const wafrnMedia = await Media.create({
          url: remoteFile.url,
          NSFW: remotePostObject.sensitive,
          userId: remoteUser.id,
          description: remoteFile.name,
          ipUpload: 'IMAGE_FROM_OTHER_FEDIVERSE_INSTANCE',
          adultContent: remotePostObject.sensitive,
          external: true
        })
        medias.push(wafrnMedia)
        mediasString = mediasString + '[wafrnmediaid="' + wafrnMedia.id + '"]'
      }
    }
    const postToCreate = {
      content: postPetition.content + mediasString,
      content_warning: postPetition.sensitive ? postPetition.summary : '',
      createdAt: new Date(postPetition.published),
      updatedAt: new Date(),
      userId: remoteUser.id,
      remotePostId
    }
    if (postPetition.inReplyTo) {
      const parent = await getPostThreadRecursive(user, postPetition.inReplyTo)
      const newPost = await Post.create(postToCreate)
      await newPost.setParent(parent)
      await newPost.save()
      newPost.addMedias(medias)
      return newPost
    } else {
      const post = await Post.create(postToCreate)
      post.addMedias(medias)
      return post
    }
  }
}

async function remoteFollow (localUser: any, remoteUser: any) {
  const petitionBody = { '@context': 'https://www.w3.org/ns/activitystreams',
  id: environment.frontendUrl + '/fediverse/follows/'+ localUser.id + '/' + remoteUser.id,
  type: 'Follow',
  actor: environment.frontendUrl + '/fediverse/blog/' + localUser.url,
  object: remoteUser.remoteId
 }
 const followPetition = await postPetitionSigned(petitionBody, localUser, remoteUser.remoteInbox)
  return followPetition
}


export { activityPubRoutes, remoteFollow, getRemoteActor, signedGetPetition }
