import { Request, Response, NextFunction } from 'express'
import { FederatedHost, User, sequelize } from '../../db'
import { environment } from '../../environment'
import { getRemoteActor } from './getRemoteActor'
import { logger } from '../logger'
import crypto from 'crypto'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const httpSignature = require('@peertube/http-signature')
import Redis from 'ioredis'
import { Op } from 'sequelize'
const adminUser = environment.forceSync
  ? null
  : User.findOne({
      where: {
        url: environment.adminUser
      }
    })

const redis = new Redis(environment.redisioConnection)

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
      let bannedHostInCache = await redis.get('server:' + hostUrl)
      if (bannedHostInCache === null || bannedHostInCache === undefined) {
        const newResult = await FederatedHost.findOne({
          where: {
            [Op.or]: [
              sequelize.where(sequelize.fn('LOWER', sequelize.col('displayName')), 'LIKE', `${hostUrl.toLowerCase()}`)
            ]
          }
        })
        bannedHostInCache = newResult?.blocked.toString().toLowerCase()
        redis.set('server:' + hostUrl, bannedHostInCache ? bannedHostInCache : 'false')
      }
      if (bannedHostInCache === 'true') {
        return res.sendStatus(401)
      }
      success = true
      const cachedKey = await redis.get('key:' + remoteUserUrl)
      const remoteKey = cachedKey ? cachedKey : (await getRemoteActor(remoteUserUrl, await adminUser)).publicKey
      if (!cachedKey) {
        redis.set('key:' + remoteUserUrl, remoteKey)
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
