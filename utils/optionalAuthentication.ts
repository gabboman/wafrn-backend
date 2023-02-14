import { Request, Response, NextFunction } from 'express'
const jwt = require('jsonwebtoken')
const environment = require('../environment')

export default function optionalAuthentication (
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]
  
    jwt.verify(
      token,
      environment.jwtSecret as string,
      (err: any, jwtData: any) => {
        if (err) {
          (req as any).jwtData = false;
          next()
        }
  
        (req as any).jwtData = jwtData
        next()
      }
    )
  } catch (error) {
    (req as any).jwtData = false;
    next()
  }

}
