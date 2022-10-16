/* eslint-disable max-len */
import {
  Application,
} from 'express';
import {
  Media,
} from '../models';
import authenticateToken from '../utils/authenticateToken';
import getIp from '../utils/getIP';
import optimizeMedia from '../utils/optimizeMedia';
const environment = require('../environment');

export default function mediaRoutes(app: Application) {
  app.post('/uploadMedia', authenticateToken, async (req: any, res) => {
    const files: any = req.files;
    const picturesPromise: Array < any > = [];
    if (files && files.length > 0) {
      for (const file of files) {
        let fileUrl = '/' + file.path;
        const originalNameArray = fileUrl.split('.');
        const extension = originalNameArray[originalNameArray.length - 1].toLowerCase();
        const formatsToNotConvert = ['webp'];
        if ( formatsToNotConvert.indexOf(extension) == -1) {
          fileUrl = '/' + await optimizeMedia(file.path);
        }
        if (environment.removeFolderNameFromFileUploads) {
          fileUrl = fileUrl.slice('/uploads/'.length - 1);
        }

        picturesPromise.push(
            Media.create({
              url: fileUrl,
              // if its marked as adult content it must be NSFW
              NSFW: req.body.adultContent == 'true' ? true : req.body.nsfw === 'true',
              userId: req.jwtData.userId,
              description: req.body.description,
              ipUpload: getIp(req),
              adultContent: req.body.adultContent == 'true',
            }),
        );
      }
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
          mediaToUpdate.NSFW = req.body.adultContent == 'true' ? true : req.body.nsfw === 'true';
          mediaToUpdate.adultContent = req.body.adultContent == 'true';
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
