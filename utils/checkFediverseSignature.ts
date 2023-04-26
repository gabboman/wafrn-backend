import { Request, Response, NextFunction } from 'express'
import { User } from '../db';
import { signedGetPetition } from '../routes/activitypub';
import { environment } from '../environment'
import { logger } from './logger';
import { getRemoteActor } from '../routes/activitypub';
var httpSignature = require('@peertube/http-signature');

const user = User.findOne({
  where: {
    url: environment.adminUser
  }
}) 
export default async function checkFediverseSignature (
  req: Request,
  res: Response,
  next: NextFunction
) {
  let success = false
  const digest = req.headers.digest
  const signature = req.headers.signature
  if (digest && signature) {
    // TODO check signatures for the love of god
    success = true
    try {
      const sigHead = httpSignature.parse(req)
      const remoteUserUrl = sigHead.keyId.splice('#')[0]
      const remoteUser = await getRemoteActor(remoteUserUrl, user)
      const remoteKey = remoteUser.publicKey
      // TODO still not finished
      success = true
      //success = httpSignature.verifySignature(sigHead,  remoteKey)

    } catch (error: any) {
      if(error?.code_get === 410) {
        // TODO. the user has been deleted
        success = false;
        
      } else {
        logger.trace({message: 'error while parsing signature', error: error})
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
