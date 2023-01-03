import axios from 'axios'
import { Application } from 'express'
import { User, FederatedHost, Follows } from '../models'
import checkFediverseSignature from '../utils/checkFediverseSignature'
import { createHash, createSign } from 'crypto'
import sequelize from '../db'

const environment = require('../environment')


// all the stuff related to activitypub goes here

export default function activityPubRoutes (app: Application) {
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
          where:  sequelize.where(
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
        where:  sequelize.where(
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
        where:  sequelize.where(
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
          first: 'https://hamburguesa.minecraftanarquia.xyz/users/admin/following?page=1'
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
        where:  sequelize.where(
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
          first: 'https://hamburguesa.minecraftanarquia.xyz/users/admin/followers?page=1'
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
        where:  sequelize.where(
          sequelize.fn('LOWER', sequelize.col('url')),
          'LIKE',
          url.toLowerCase()
        )
      })
      if (user) {
        try {
          const remoteUser = await getRemoteActor(req.body.actor, user)
          switch (req.body.type) {
            case 'Follow': {
              res.sendStatus(200)
              let remoteFollow = await Follows.findOne({
                where: {
                  followerId: remoteUser.id,
                  followedId: user.id
                }
              });
              if(!remoteFollow) {
                await remoteUser.addFollower(user);
                await remoteUser.save();
                remoteFollow = await Follows.findOne({
                  where: {
                    followerId: remoteUser.id,
                    followedId: user.id
                  }
                });
              }
              
              remoteFollow.remoteFollowId = req.body.id;
              remoteFollow.save();
              // we accept it
              await signAndAccept(req, remoteUser, user)
              break;
            }
            case 'Undo': {
              
              res.sendStatus(200)
              const body = req.body
              switch(body.object.type) {
                case 'Follow': {
                  const remoteFollow = await Follows.findOne({
                    where: {
                      followerId: remoteUser.id,
                      followedId: user.id,
                      remoteFollowId: body.object.id
                    }
                  });
                  await remoteFollow.destroy()
                  await signAndAccept(req, remoteUser, user)
                }
                default: {
                  
                }
              }
              break;
            }
            default: {
              res.sendStatus(200)
  
            }
          }

        } catch (error) {
          console.log('WE HAVE A PROBLEM')
          console.error(error);
          //res.send(500)
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


async function getRemoteActor(actorUrl: string, user: any) {
  const url = new URL(actorUrl);

  const userPetition = await axios.get(actorUrl, {
    headers: {
      ...await getSignHeaders({}, user, actorUrl, 'get' )
    }, 
    data: {},
  })
  
  let remoteUser = await User.findOne({
    where: {
      url: '@' + userPetition.data.preferredUsername + '@' + url.host
    }
  })

  if(!remoteUser) {
    const userToCreate = {
      url: '@' + userPetition.data.preferredUsername + '@' + url.host,
      email: null,
      description: userPetition.data.summary,
      avatar: userPetition.data.icon?.url ? userPetition.data.icon.url : '/uploads/default.webp',
      password: 'NOT_A_WAFRN_USER_NOT_REAL_PASSWORD',
      publicKey: userPetition.data.publicKey?.publicKeyPem,
      remoteInbox: userPetition.data.inbox,
      remoteId: actorUrl
    }
    remoteUser = await User.create(userToCreate);

    let federatedHost = await FederatedHost.findOne({
      where: {
        displayName: url.host.toLocaleLowerCase()
      }
    });
    if(!federatedHost) {
      const federatedHostToCreate = {
        displayName: url.host,
        publicInbox: userPetition.data.endpoints?.sharedInbox
      }
      federatedHost = await FederatedHost.create(federatedHostToCreate)
    }

    await federatedHost.addUser(remoteUser)
  }

  return remoteUser;

}

function getSignHeaders(message: any, user: any, target: string, method: string) : any {
  const url = new URL(target)
  const digest = createHash('sha256').update(JSON.stringify(message)).digest('base64')
  const signer = createSign('sha256')
  const sendDate = new Date()
  let stringToSign = `(request-target): ${method} ${url.pathname}\nhost: ${url.host}\ndate: ${sendDate.toUTCString()}\ndigest: SHA-256=${digest}`;
  signer.update(stringToSign);
  signer.end();
  const signature = signer.sign(user.privateKey).toString('base64')
  const header = `keyId="${environment.frontendUrl}/fediverse/blog/${user.url.toLocaleLowerCase()}#main-key",headers="(request-target) host date digest",signature="${signature}"`;
  return {
    'Content-Type': 'application/activity+json',
    Accept: 'application/activity+json',
    Host: url.host,
    Date: sendDate.toUTCString(),
    Digest: `SHA-256=${digest}`,
    Signature: header
  }

}

async function signAndAccept(req: any, remoteUser: any, user: any ) {
  const acceptMessage = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': req.body.id,
    'type': 'Accept',
    'actor': environment.frontendUrl + '/fediverse/blog/' + user.url.toLowerCase(),
    'object': req.body,
  }
  const acceptPetition = await axios.post(remoteUser.remoteInbox,
    acceptMessage,
    {
      headers: {
        ... await getSignHeaders(acceptMessage, user, remoteUser.remoteInbox, 'post' )
      }
  })
}