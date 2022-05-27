/* eslint-disable require-jsdoc */
'use strict';



const Sequelize = require('sequelize');
// sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize);

// operators
const {Op} = require('sequelize');
const environment = require('./environment');

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport(
    environment.emailConfig,
);


const sequelize = new Sequelize(
    environment.databaseConnectionString,
    {
      logging: !environment.prod,
    },
);

const User = sequelize.define('users', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
  },
  description: Sequelize.TEXT,
  url: {
    type: Sequelize.STRING,
    unique: true,
  },
  NSFW: Sequelize.BOOLEAN,
  avatar: Sequelize.STRING,
  password: Sequelize.STRING,
  birthDate: Sequelize.DATE,
  activated: Sequelize.BOOLEAN,
  // we see the date that the user asked for a password reset. Valid for 2 hours
  requestedPasswordReset: Sequelize.DATE,
  // we use activationCode for activating the account & for reset the password
  // could generate some mistakes but consider worth it
  activationCode: Sequelize.STRING,
  registerIp: Sequelize.STRING,
  lastLoginIp: Sequelize.STRING,
  lastTimeNotificationsCheck: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: new Date().setTime(0),
  },
});

const Post = sequelize.define('posts', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  NSFW: Sequelize.BOOLEAN,
  content: Sequelize.TEXT,
});

const Tag = sequelize.define('tags', {
  // NSFW: Sequelize.BOOLEAN,
  tagName: Sequelize.TEXT,
});

const Media = sequelize.define('medias', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  NSFW: Sequelize.BOOLEAN,
  description: Sequelize.TEXT,
  url: Sequelize.TEXT,
  ipUpload: Sequelize.STRING,
});

const PostReport = sequelize.define('postReports', {
  resolved: Sequelize.BOOLEAN,
  severity: Sequelize.INTEGER,
  description: Sequelize.TEXT,
});

const UserReport = sequelize.define('userReports', {
  resolved: Sequelize.BOOLEAN,
  severity: Sequelize.INTEGER,
  description: Sequelize.TEXT,

});

const PostView = sequelize.define('postViews', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  postId: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: 'posts',
      key: 'id',
    },
    unique: false,
  },
});

PostView.belongsTo(Post);
User.belongsToMany(User, {
  through: 'follows',
  as: 'followed',
  foreignKey: 'followedId',
});

User.belongsToMany(User, {
  through: 'follows',
  as: 'follower',
  foreignKey: 'followerId',
});

User.belongsToMany(User, {
  through: 'blocks',
  as: 'blocker',
  foreignKey: 'blockerId',
});

User.belongsToMany(User, {
  through: 'blocks',
  as: 'blocked',
  foreignKey: 'blockedId',
});

PostReport.belongsTo(User);
PostReport.belongsTo(Post);

UserReport.belongsTo(User, {foreignKey: 'ReporterId'});
UserReport.belongsTo(User, {foreignKey: 'ReportedId'});

User.hasMany(Post);
Post.belongsTo(User);
Post.isHierarchy();
Media.belongsTo(User);
Tag.belongsToMany(Post, {
  through: 'tagPostRelations',
});
Post.belongsToMany(Tag, {
  through: 'tagPostRelations',

});
Media.belongsToMany(Post, {
  through: 'postMediaRelations',
});
Post.belongsToMany(Media, {
  through: 'postMediaRelations',
});


sequelize.sync({
  force: environment.forceSync,
})
    .then(async () => {
      console.log(`Database & tables ready!`);
      if (environment.forceSync) {
        console.log('CLEANING DATA');
      // seeder();
      }
    });


// eslint-disable-next-line max-len
async function sendEmail(email: string, subject: string, contents: string) {
  // const activateLink = code;
  return await transporter.sendMail({
    from: {
      name: 'wafrn',
      address: environment.emailConfig.auth.user,
    },
    to: email,
    subject: subject,
    html: contents,
  });
}

async function getBlockedids(userId: string): Promise<string[]> {
  const usr = await User.findOne({
    where: {
      id: userId,
    },
    attributes: ['id'],
  });
  const blocked = usr.getBlocked();
  const blockedBy = usr.getBlocker();
  await Promise.all([blocked, blockedBy]);
  let result = (await blocked).map((blocked: any) => blocked.id);
  result = result.concat((await blockedBy).map((blocker: any) => blocker.id));
  return result.filter((elem: string) => elem != userId);
}


async function getAllPostsByuser(userId: string): Promise<any> {
  const postsId = await Post.findAll({
    where: {
      userId: userId,
    },
    attributes: ['id'],
  });
  return postsId;
}

async function getAllPostsIdsByUser(userId: string): Promise<string[]> {
  const postsId = await getAllPostsByuser(userId);
  const result = postsId.map((followed: any) => followed.id);
  return result;
}



async function getNotifications(userId: string) {
  const userPosts = await getAllPostsByuser(userId);
  const user = await User.findOne({
    where: {
      id: userId,
    },
  });
  const blockedUsers = await getBlockedids(userId);
  const perPostReblogsPromises: Array<Promise<any>> = [];
  try {
    userPosts.forEach((post: any) => {
      perPostReblogsPromises.push(post.getDescendents({
        where: {
          createdAt: {
            [Op.gt]: new Date(user.lastTimeNotificationsCheck),
          },
        },
        include: [
          {
            model: User,
            attributes: ['id', 'avatar', 'url', 'description'],
          },
        ],
      }));
    });
  } catch (error) {
    console.error(error);
  }
  const newFollows = user.getFollower({
    where: {
      createdAt: {
        [Op.gt]: new Date(user.lastTimeNotificationsCheck),
      },
    },
    attributes: ['url', 'avatar'],
  });
  return {
    // eslint-disable-next-line max-len
    follows: (await newFollows).filter((newFollow: any) => blockedUsers.indexOf(newFollow.id) == -1),
    // eslint-disable-next-line max-len
    reblogs: (await Promise.all(perPostReblogsPromises)).flat().filter((newReblog: any) => blockedUsers.indexOf(newReblog.user.id) == -1),
  };
}
function delay(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function asyncForEach(array: any[], callback: any) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

User.findAll({
  where: {
    activated: true,
    // id: 'bd78a757-b69e-482c-b4a6-dd6ec62eb933',
  },
}).then(async (users:any) => {
  asyncForEach(users, async (user: any) => {
    const notifications = await getNotifications(user.id);
    // eslint-disable-next-line max-len
    const numberNotifications = notifications.follows.length + notifications.reblogs.length;
    const subject = 'Hello  ' + user.url +
      ', we are still online! You have ' +
      // eslint-disable-next-line max-len
      numberNotifications + ' unread notifications';
    const emailBody = '<h1>Hello ' + user.url + ',</h1>' +
    '<h1>We\'ve been (not) working hard at <a href="https://app.wafrn.net">wafrn</a>.</h1>' +
    '<p>We have been really busy with real life and work, so we still do not have likes nor asks, but SOON</p>' +
    // eslint-disable-next-line max-len
    '<p>You\'ve got ' +
    notifications.follows.length +' new followers in ' +
    '<a href="https://app.wafrn.net">wafrn</a></p>' +
    '<p>And your posts have been reblogged ...' + notifications.reblogs.length +
    // eslint-disable-next-line max-len
    ' times! This includes reblogs of reblogs of reblogs of... </p>' +
    // eslint-disable-next-line max-len
    '<p>Bear in mind this number might be different than the one in the webpage, we are (not) working on it, and we are (totally not) aware of it</p>' +
    '<h1>Come back to  ' +
    '<a href="https://app.wafrn.net">wafrn</a>? The best worst internet hellhole</h1>' +
    '<h2>We promise that it\'s kinda cool!</h2>' +
    // eslint-disable-next-line max-len
    '<h5>What? You haven\'t heard <a href="https://app.wafrn.net/post/ea7c5c26-46cb-4870-8e78-2d9a4fe6cf95">about the minecraft server</a>?</h5>' +
    '<h5>Nor <a href="https://app.wafrn.net/post/ad12dc31-4eab-403c-b383-574b8fd245ca">about the dark secret of the pizza</a>?</h5>' +
    '<h6>It would be a great time to fix it :D</h6>' +
    // eslint-disable-next-line max-len
    '<p>Please bear in mind it\'s an anarchy server. The comunity is really small and tame, but we can not guarantee its a safe space</p>';

    try {
      if (numberNotifications > 0) {
        // eslint-disable-next-line max-len
        console.log('sending email to ' + user.email + ', ' + numberNotifications.toString() + ' notifications');
        await sendEmail(user.email, subject, emailBody);
        await delay(5000);
      }
    } catch (error) {
      console.error(error);
    }
  });
});
