import { Application } from 'express'
import { User, Follows, Post, Media, UserLikesPostRelations } from '../../db'
import checkFediverseSignature from '../../utils/activitypub/checkFediverseSignature'
import { sequelize } from '../../db'
import { Op } from 'sequelize'

import { environment } from '../../environment'
import { logger } from '../../utils/logger'

import { getRemoteActor } from '../../utils/activitypub/getRemoteActor'
import { removeUser } from '../../utils/activitypub/removeUser'
import { signAndAccept } from '../../utils/activitypub/signAndAccept'
import { getPostThreadRecursive } from '../../utils/activitypub/getPostThreadRecursive'
import { return404 } from '../../utils/return404'
import { postToJSONLD } from '../../utils/activitypub/postToJSONLD'
import { Queue } from 'bullmq'

// global activitypub variables

// queues

const inboxQueue = new Queue('inbox', {
  connection: environment.bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000
  }
})

// all the stuff related to activitypub goes here

function activityPubRoutes(app: Application) {
  // get post
  app.get(['/fediverse/post/:id', '/fediverse/activity/post/:id'], async (req: any, res) => {
    if (req.params?.id) {
      const post = await Post.findOne({
        where: {
          id: req.params.id,
          privacy: {
            [Op.notIn]: [2, 10]
          }
        }
      })
      if (post) {
        // TODO corregir esto seguramente
        res.send(await postToJSONLD(post))
      } else {
        res.sendStatus(404)
      }
    } else {
      res.sendStatus(404)
    }
    res.end()
  })
  // Get blog for fediverse
  app.get('/fediverse/blog/:url', async (req: any, res) => {
    if (req.params?.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.cache(url).findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', url)
      })
      if (user) {
        const userForFediverse = {
          '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
          id: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`,
          type: 'Person',
          following: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/following`,
          followers: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/followers`,
          featured: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/featured`,
          inbox: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/inbox`,
          outbox: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/outbox`,
          preferredUsername: user.url.toLowerCase(),
          name: user.url,
          summary: user.description,
          url: `${environment.frontendUrl}/blog/${user.url.toLowerCase()}`,
          manuallyApprovesFollowers: false,
          discoverable: true,
          published: user.createdAt,
          endpoints: {
            sharedInbox: `${environment.frontendUrl}/fediverse/sharedInbox`
          },
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
            id: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}#main-key`,
            owner: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}`,
            publicKeyPem: user.publicKey
          }
        }

        res
          .set({
            'content-type': 'application/activity+json'
          })
          .send(userForFediverse)
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
    res.end()
  })

  app.get('/fediverse/blog/:url/following', async (req: any, res) => {
    if (req.params?.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.cache(url).findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', url.toLowerCase())
      })
      if (user) {
        const followed = await User.findAll({
          where: {
            literal: sequelize.literal(`id in (SELECT "followedId" from follows where "followerId" like '${user.id}')`)
          }
        })
        let response: any = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/following`,
          type: 'OrderedCollection',
          totalItems: followed.length,
          first: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/following?page=1`
        }
        if (req.query?.page) {
          response = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            id: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/following`,
            type: 'OrderedCollection',
            totalItems: followed.length,
            partOf: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/following`,
            orderedItems: followed.map((elem: any) =>
              elem.remoteId ? elem.remoteId : `${environment.frontendUrl}/fediverse/blog/${elem.url}`
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
    res.end()
  })

  app.get('/fediverse/blog/:url/followers', async (req: any, res) => {
    if (req.params?.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.cache(url).findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', url.toLowerCase())
      })
      if (user) {
        //const followers = await user.getFollower()
        const followers = await User.findAll({
          where: {
            literal: sequelize.literal(`id in (SELECT "followerId" from follows where "followedId" like '${user.id}')`)
          }
        })
        let response: any = {
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/followers`,
          type: 'OrderedCollection',
          totalItems: followers.length,
          first: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/followers?page=1`
        }
        if (req.query?.page) {
          response = {
            '@context': 'https://www.w3.org/ns/activitystreams',
            id: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/followers`,
            type: 'OrderedCollection',
            totalItems: followers.length,
            partOf: `${environment.frontendUrl}/fediverse/blog/${user.url.toLowerCase()}/followers`,
            orderedItems: followers.map((elem: any) =>
              elem.remoteId ? elem.remoteId : `${environment.frontendUrl}/fediverse/blog/${elem.url}`
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
    res.end()
  })

  app.get('/fediverse/blog/:url/featured', async (req: any, res) => {
    if (req.params?.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.cache(url).findOne({
        where: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', url.toLowerCase())
      })
      if (user) {
        res.send({
          '@context': 'https://www.w3.org/ns/activitystreams',
          id: `${environment.frontendUrl}/fediverse/blog/${req.params.url}/featured`,
          type: 'OrderedCollection',
          totalItems: 0,
          orderedItems: []
        })
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
    res.end()
  })

  // HERE is where the meat and potatoes are. This endpoint is what we use to recive stuff
 
  app.post(['/fediverse/blog/:url/inbox', '/fediverse/sharedInbox'], checkFediverseSignature, async (req: any, res) => {
    const urlToSearch = req.params?.url ? req.params.url : environment.deletedUser
    const url = urlToSearch.toLowerCase()
    const user = await User.cache(url).findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', url.toLowerCase())
    })
    if (user) {
      try {
        res.sendStatus(200);
        inboxQueue.add(
          'processInbox',
          { petition: req.body, petitionBy: user.id },
          { jobId: req.body.id }
        )

      } catch (error) {
        logger.trace({
          error: error,
          type: req.body.type
        })
      }
    } else {
      return404(res)
    }
    res.end()
  })

  app.get('/fediverse/blog/:url/outbox', async (req: any, res) => {
    if (req.params?.url) {
      const url = req.params.url.toLowerCase()
      const user = await User.cache(url).findOne({
        where: {
          url: url
        }
      })
      if (user) {
        res.sendStatus(200)
      } else {
        return404(res)
      }
    } else {
      return404(res)
    }
    res.end()
  })
}

export { activityPubRoutes }
