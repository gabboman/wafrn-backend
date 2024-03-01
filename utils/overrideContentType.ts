import { Request, Response, NextFunction } from 'express'

export default function overrideContentType(req: Request, res: Response, next: NextFunction) {
  const UrlPath = req.path
  if (UrlPath.startsWith('/fediverse')) {
    req.headers['content-type'] = 'application/json;charset=UTF-8'
  }
  if (req.headers.accept?.includes('*/*')) {
    // its an user asking for the location
    if (UrlPath.startsWith('/fediverse/')) {
      res.redirect(UrlPath.split('/fediverse')[1])
    } else {
      next()
    }
  } else {
    next()
  }
}
