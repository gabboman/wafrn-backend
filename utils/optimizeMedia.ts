/* eslint-disable max-len */
const webp = require('webp-converter');
//import VideoConverter from 'convert-video'
const fs = require('fs');

export default function optimizeMedia(inputPath: string): string {
  const fileAndExtension = inputPath.split('.');
  const originalExtension = fileAndExtension[1].toLowerCase();
  fileAndExtension[1] = 'webp';
  const outputPath = fileAndExtension.join('.');
  switch (originalExtension) {
    case 'gif':
      webp.gwebp(inputPath, outputPath, '-q 85').then(()=> {
        fs.unlinkSync(inputPath, ()=> {});
      });
      break;
    case 'webm': case 'mov':
      // VideoConverter.convert(inputPath, 'mp4');
    default:
      webp.cwebp(inputPath, outputPath, '-q 90').then(()=> {
        fs.unlinkSync(inputPath, ()=> {});
      });
  }
  return outputPath;
}
