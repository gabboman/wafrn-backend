import sequelize from './db';
import {Media, User} from './models';
import optimizeMedia from './utils/optimizeMedia';
const environment = require('./environment');


sequelize
    .sync({
      force: environment.forceSync,
    })
    .then(async () => {
      console.log(`Database & tables ready!`);
      if (environment.forceSync) {
        console.log('CLEANING DATA');
      // seeder();
      }
    });

async function start() {
  const medias = await Media.findAll();
  const users = await User.findAll();
  for (const media of medias) {
    if (media.url.indexOf('//') == -1) {
      const newUrl = optimizeMedia('uploads' +media.url);
      media.url = newUrl.slice(7);
      await media.save();
    }
  }
  for (const user of users) {
    const newAvatar = optimizeMedia('uploads' + user.avatar);
    user.avatar = newAvatar.slice(7);
    await user.save();
  }
}

start().then(()=> {
  console.log('all good');
}).catch(()=> {
  console.warn('oh no');
});
