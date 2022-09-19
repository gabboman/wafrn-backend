// This file is a legacy file that was used for converting
// all the images to webp. This file will be deleted next commit probably
import sequelize from './db';
import {User} from './models';
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
  const users = await User.findAll();
  for (const user of users) {
    if (user.email !== user.email.toLowerCase()) {
      console.log(user.email);
    }
    try {
      user.email = user.email.toLowerCase();
      await user.save();
    } catch (error) {
      console.log('error with ' + user.email);
    }
  }
}

start().then(()=> {
  console.log('all good');
}).catch((error)=> {
  console.error(error);
  console.warn('oh no');
});
