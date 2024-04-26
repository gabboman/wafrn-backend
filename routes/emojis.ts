import { Application, Response } from "express";
import { adminToken, authenticateToken } from "../utils/authenticateToken";
import AuthorizedRequest from '../interfaces/authorizedRequest'
import uploadHandler from "../utils/uploads";
import multer from 'multer'

const emojiStorage = multer.diskStorage({
    destination: '/tmp/',
    filename: (req, file, cb) => {
      const originalNameArray = file.originalname.split('.')
      const extension = originalNameArray[originalNameArray.length - 1]
      cb(null, `${Date.now()}_emoji.${extension.toLocaleLowerCase()}`)
    }
  })



export default function emojiRoutes(app: Application) {
    app.post(
        '/api/admin/addEmoji',
        authenticateToken,
        adminToken,
        uploadHandler(/\.(png|jpg|jpeg|gifv|gif|webp|zip)$/, emojiStorage).single('emoji'),
        async (req: AuthorizedRequest, res: Response) => {
          const file = req.file as Express.Multer.File
          
        })
}