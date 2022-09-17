/* eslint-disable max-len */
const fs = require('fs');
const webp = require('webp-converter');
const FfmpegCommand = require('fluent-ffmpeg');

export default function optimizeMedia(inputPath: string): string {
  const fileAndExtension = inputPath.split('.');
  const originalExtension = fileAndExtension[1].toLowerCase();
  fileAndExtension[1] = 'webp';
  let outputPath = fileAndExtension.join('.');
  switch (originalExtension) {
    case 'gif':
      webp.gwebp(inputPath, outputPath, '-q 85').then(()=> {
        fs.unlinkSync(inputPath, ()=> {});
      });
      break;
    case 'webm': case 'mov':
      fileAndExtension[1] = 'mp4';
      outputPath = fileAndExtension.join('.');
      // eslint-disable-next-line no-unused-vars
      const command = new FfmpegCommand(inputPath)
          .inputOptions('-t 420')
          .videoCodec('libx264')
          .audioCodec('libmp3lame')
          .save(outputPath)
          .on('end', () => {
            fs.unlinkSync(inputPath, ()=> {});
          });
      break;
    default:
      webp.cwebp(inputPath, outputPath, '-q 90').then(()=> {
        fs.unlinkSync(inputPath, ()=> {});
      });
  }
  return outputPath;
}
