import { Request, Response, NextFunction } from 'express'
import { FederatedHost, User } from '../../db'
import { environment } from '../../environment'
import { Op } from 'sequelize'
import { getRemoteActor } from './getRemoteActor'
import { LdSignature } from './rsa2017'
import { logger } from '../logger'
import crypto from 'crypto'
const httpSignature = require('@peertube/http-signature')
import Redis from "ioredis"
const adminUser = environment.forceSync
  ? null
  : User.findOne({
      where: {
        url: environment.adminUser
      }
    })

const redis = new Redis(environment.redisioConnection);
if (!environment.forceSync) {
  User.findAll({
    where: {
      remoteId: { [Op.ne]: null }
    }
  }).then((allUsers: any) => {
    allUsers.forEach((user: any) => {
      redis.set("key/" + user.remoteId, user.publicKey)
    })
  })

  FederatedHost.findAll({
    where: {
      blocked: true
    }
  }).then((queryBanedHosts: any[]) => {
    queryBanedHosts.forEach((host: any) => {
      redis.set("server/" + host.displayName, "true")
    })
  })
}

export default async function checkFediverseSignature(req: Request, res: Response, next: NextFunction) {
  let success = false
  const digest = req.headers.digest
  const signature = req.headers.signature
  if (digest && signature) {
    // TODO check signatures for the love of god
    success = true
    try {
      // TODO do stuff here
      const sigHead = httpSignature.parseRequest(req)
      const remoteUserUrl = sigHead.keyId.split('#')[0]
      const hostUrl = new URL(remoteUserUrl).host
      const bannedHostInCache = await redis.get("server/" + hostUrl)
      if (bannedHostInCache) {
        return res.sendStatus(401)
      }
      success = true
      const cachedKey = await redis.get("key/" +remoteUserUrl)
      const remoteKey = cachedKey ? cachedKey : (await getRemoteActor(remoteUserUrl, await adminUser)).publicKey;
      if (!cachedKey) {
        redis.set("key/" + remoteUserUrl, remoteKey)
      }
      //const tmp = httpSignature.verifySignature(sigHead,  remoteKey)
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(sigHead.signingString, 'ascii')
      const publicKeyBuf = Buffer.from(remoteKey, 'ascii')
      const signatureBuf = Buffer.from(sigHead.params.signature, 'base64')
      const tmp = verifier.verify(publicKeyBuf, signatureBuf)
      if (!tmp) {
        logger.trace(`Failed to verify signature from ${remoteUserUrl}`)
      }
      //success = httpSignature.verifySignature(sigHead,  remoteKey)
    } catch (error: any) {
      success = false
    }
  }
  if (!success) {
    return res.sendStatus(401)
  } else {
    next()
  }
}
