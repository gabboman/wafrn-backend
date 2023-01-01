import { Request, Response, NextFunction } from 'express'

export default function overrideContentType (
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    req.headers['content-type'] &&
        req.headers['content-type'] === 'application/activity+json') {
    req.headers['content-type'] = 'application/json;charset=UTF-8'
  }
  next()
}
