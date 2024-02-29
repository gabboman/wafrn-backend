import { Request, Response, NextFunction } from 'express'

export default function overrideContentType(req: Request, res: Response, next: NextFunction) {
  const UrlPath = req.path
  if (req.headers['content-type'] && req.headers['content-type'] === 'application/activity+json') {
    req.headers['content-type'] = 'application/json;charset=UTF-8'
    next()
    /*
    // its a mastodon server asking for stuff
    if (UrlPath.startsWith('/fediverse/') || UrlPath.startsWith('.well-known')) {
    } else {
      res.redirect(`/fediverse/${UrlPath}`)
      res.send()
    }
    */
  } else {
    // its an user asking for the location
    if (UrlPath.startsWith('/fediverse/')) {
      res.redirect(UrlPath.split('/fediverse')[1])
    } else {
      next()
    }
  }
}
