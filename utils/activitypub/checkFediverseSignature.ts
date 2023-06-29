import { Request, Response, NextFunction } from 'express'
import { User } from '../../db'
import { environment } from '../../environment'
import { Op } from 'sequelize'
import { getRemoteActor } from './getRemoteActor'
import { LdSignature } from './rsa2017'
import { logger } from '../logger'
import crypto from 'crypto'
const httpSignature = require('@peertube/http-signature')

const adminUser = environment.forceSync
  ? null
  : User.findOne({
      where: {
        url: environment.adminUser
      }
    })

const actorsCache: Map<string, string> = new Map()

User.findAll({
  where: {
    remoteId: { [Op.ne]: null }
  }
}).then((allUsers: any) => {
  allUsers.forEach((user: any) => {
    actorsCache.set(user.remoteId, user.publicKey)
  })
})

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
      success = true
      const cachedKey = actorsCache.get(remoteUserUrl)
      const remoteKey = cachedKey ? cachedKey : (await getRemoteActor(remoteUserUrl, adminUser)).publicKey
      //const tmp = httpSignature.verifySignature(sigHead,  remoteKey)
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(sigHead.signingString, 'ascii')
      const publicKeyBuf = Buffer.from(remoteKey, 'ascii')
      const signatureBuf = Buffer.from(sigHead.params.signature, 'base64')
      const tmp = verifier.verify(publicKeyBuf, signatureBuf)
      if (!tmp) {
        logger.debug(`Failed to verify signature from ${remoteUserUrl}`)
      }
      //success = httpSignature.verifySignature(sigHead,  remoteKey)
    } catch (error: any) {
      success = false
    }
  }
  if (!success) {
    return res.sendStatus(403)
  } else {
    next()
  }
}
