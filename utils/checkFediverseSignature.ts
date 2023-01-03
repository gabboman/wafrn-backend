import { Request, Response, NextFunction } from 'express'
const environment = require('../environment')

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
  }
  if (!success) {
    return res.sendStatus(401)
  } else {
    next()
  }
}
