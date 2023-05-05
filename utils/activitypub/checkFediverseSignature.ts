import { Request, Response, NextFunction } from 'express'
import { FederatedHost, User } from '../../db'
import { environment } from '../../environment'
import { logger } from '../logger'
import { getRemoteActor } from './getRemoteActor'
const httpSignature = require('@peertube/http-signature')

const user = User.findOne({
  where: {
    url: environment.adminUser
  }
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
      const sigHead = httpSignature.parse(req)
      const remoteUserUrl = sigHead.keyId.split('#')[0]
      const remoteUser = await getRemoteActor(remoteUserUrl, await user)
      const remoteKey = remoteUser.publicKey
      success = true

      const hostBanned = await FederatedHost.findOne({
        where: {
          displayName: new URL(remoteUserUrl).host,
          blocked: true
        }
      })

      if (hostBanned || remoteUser.banned) {
        success = false
        logger.trace(`Ignoring message from ${remoteUserUrl} because its on our list of evildoers`)
      }
      //const tmp = httpSignature.verifySignature(sigHead,  remoteKey)
      //success = httpSignature.verifySignature(sigHead,  remoteKey)
    } catch (error: any) {
      if (error?.code_get === 410) {
        success = false
      } else {
        //logger.trace({message: 'error while parsing signature', error: error,  })
        // success = true
      }
    }
  }
  if (!success) {
    return res.sendStatus(403)
  } else {
    next()
  }
}
