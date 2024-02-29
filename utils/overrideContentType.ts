import { Request, Response, NextFunction } from 'express'

export default function overrideContentType(req: Request, res: Response, next: NextFunction) {
  const UrlPath = req.path
  if (req.headers.accept === '*/*') {
    // its an user asking for the location
    if (UrlPath.startsWith('/fediverse/')) {
      res.redirect(UrlPath.split('/fediverse')[1])
    } else {
      next()
    }
  } else {
    req.headers['content-type'] = 'application/json;charset=UTF-8'
    next()
  }
}
