/* eslint-disable max-len */
const fs = require('fs');
const FfmpegCommand = require('fluent-ffmpeg');
const gm = require('gm');
export default function optimizeMedia(inputPath: string): string {
  const fileAndExtension = inputPath.split('.');
  const originalExtension = fileAndExtension[1].toLowerCase();
  fileAndExtension[1] = 'webp';
  let outputPath = fileAndExtension.join('.');
  switch (originalExtension) {
    case 'webp':
      break;
    case 'gif':
      // eslint-disable-next-line no-unused-vars
      const gifConversion = new FfmpegCommand(inputPath)
          .addOption('-loop', '0')
          .save(outputPath)
          .on('end', () => {
            try {
              fs.unlinkSync(inputPath, ()=> {});
            } catch (exc) {
              console.warn(exc);
            }
          });
      break;
    case 'mp4':
      fileAndExtension[0] = fileAndExtension[0] + '_processed';
    case 'webm': case 'mov': case 'mkv':
      fileAndExtension[1] = 'mp4';
      outputPath = fileAndExtension.join('.');
      // eslint-disable-next-line no-unused-vars
      const command = new FfmpegCommand(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .save(outputPath)
          .on('end', () => {
            try {
              fs.unlinkSync(inputPath, ()=> {});
            } catch (exc) {
              console.warn(exc);
            }
          });
      break;
    default:
      gm(inputPath)
          .autoOrient()
          .quality(90)
          .noProfile()
          .write(outputPath, (err: any) => {
            if (!err) {
              try {
                fs.unlinkSync(inputPath, ()=> {});
              } catch (exc) {
                console.warn(exc);
              }
            } else {
              console.log(err);
            }
          });
  }
  return outputPath;
}
