import { Request, Response, NextFunction } from 'express'
const jwt = require('jsonwebtoken')
import { environment } from '../environment'

export default function authenticateToken (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(
    token,
    environment.jwtSecret as string,
    (err: any, jwtData: any) => {
      if (err) {
        return res.sendStatus(403)
      }

      (req as any).jwtData = jwtData
      next()
    }
  )
}
