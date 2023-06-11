import { Request, Response, NextFunction } from 'express'
import { User } from '../../db'
import { environment } from '../../environment'
const httpSignature = require('@peertube/http-signature')

const adminUser = environment.forceSync
  ? null
  : User.findOne({
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
      success = true
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
