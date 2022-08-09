import {Application} from 'express';
import {Media} from '../models';
import authenticateToken from '../utils/authenticateToken';
import getIp from '../utils/getIP';

export default function mediaRoutes(app: Application) {
  app.post('/uploadMedia', authenticateToken, async (req: any, res) => {
    const files: any = req.files;
    const picturesPromise: Array<any> = [];
    if (files && files.length > 0) {
      files.forEach((file: any) => {
        let fileUrl = '/' + file.path;
        if (environment.removeFolderNameFromFileUploads) {
          fileUrl = fileUrl.slice('/uploads/'.length - 1);
        }
        picturesPromise.push(
            Media.create({
              url: fileUrl,
              NSFW: req.body.nsfw === 'true',
              userId: req.jwtData.userId,
              description: req.body.description,
              ipUpload: getIp(req),
            }),
        );
      });
    }
    const success = await Promise.all(picturesPromise);
    res.send(success);
  });

  app.post('/updateMedia', authenticateToken, async (req: any, res) => {
    let success = false;
    try {
      const posterId = req.jwtData.userId;
      if (req.body && req.body.id) {
        const mediaToUpdate = await Media.findOne({
          where: {
            id: req.body.id,
            userId: posterId,
          },
        });
        if (mediaToUpdate) {
          mediaToUpdate.NSFW = req.body.nsfw;
          mediaToUpdate.description = req.body.description;
          await mediaToUpdate.save();
          success = true;
        }
      }
    } catch (error) {
      console.error(error);
    }

    res.send({
      success: success,
    });
  });
}
