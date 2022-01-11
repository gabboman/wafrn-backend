/* eslint-disable require-jsdoc */
'use strict';


import express from 'express';

const Sequelize = require('sequelize');
// sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize);

// operators
const {Op} = require('sequelize');
const environment = require('./environment');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// import bodyParser, {BodyParser} from 'body-parser';
const cors = require('cors');
const request = require('request-promise');

import multer from 'multer';
const imageStorage = multer.diskStorage({
  // Destination to store image
  destination: 'uploads',
  filename: (req, file, cb) => {
    const originalNameArray = file.originalname.split('.');
    const extension = originalNameArray[originalNameArray.length - 1];
    const randomText = generateRandomString();
    cb(null, Date.now() + '_' + randomText + '.' + extension);
  },
});

const upload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10000000, // 10000000 Bytes = 10 MB.
  },
  fileFilter(req, file, cb) {
    if (!(
      req.files &&
      req.files?.length <= 1 &&
      (req.url === '/uploadMedia' || req.url === '/register') &&
      req.method === 'POST' &&
      file.originalname.match(/\.(png|jpg|jpeg|gifv|gif|webp)$/)
    )
    ) {
      cb(null, false);
      return cb(new Error('Please upload a Image in the apropiate route'));
    }
    cb(null, true);
  },
});
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport(
    environment.emailConfig,
);

// rest of the code remains same
const app = express();
const PORT = 8000;

app.use(upload.any());
app.use(cors());
const sequelize = new Sequelize(
    environment.databaseConnectionString,
    {
      logging: false,
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


async function checkCaptcha(response: string, ip: string): Promise<boolean> {
  let res = false;
  const secretKey = environment.captchaPrivateKey;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${response}&remoteip=${ip}`;
  const googleResponse = await request(url);
  res = JSON.parse(googleResponse).success;
  return res;
}

function getIp(petition: any): string {
  // eslint-disable-next-line max-len
  return petition.header('x-forwarded-for') || petition.connection.remoteAddress;
}
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(
      token,
    environment.jwtSecret as string, (err: any, jwtData: any) => {
      if (err) return res.sendStatus(403);

      req.jwtData = jwtData;

      next();
    });
}


function validateEmail(email: string) {
  // eslint-disable-next-line max-len
  const res = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return res.test(String(email).toLowerCase());
}

function generateRandomString() {
  return crypto.createHash('sha1').
      update(Math.random().toString()).digest('hex');
}


// eslint-disable-next-line max-len
async function sendActivationEmail(email: string, code: string, subject: string, contents: string) {
  // const activateLink = code;
  return await transporter.sendMail({
    from: environment.emailConfig.auth.user,
    to: email,
    subject: subject,
    html: contents,
  });
}

async function getFollowedsIds(userId: string): Promise<string[]> {
  const usr = await User.findOne({
    where: {
      id: userId,
    },
    attributes: ['id'],
  });
  const followed = await usr.getFollowed();
  const result = followed.map((followed: any) => followed.id);
  result.push(userId);
  return result;
}

async function getAllPostsIds(userId: string): Promise<string[]> {
  const postsId = await Post.findAll({
    where: {
      userId: userId,
    },
    attributes: ['id'],
  });
  const result = postsId.map((followed: any) => followed.id);
  return result;
}

function getPostBaseQuery(req: any) {
  return {
    include: [
      {
        model: Post,
        as: 'ancestors',
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description'],
          },
          {
            model: Media,
          },
        ],
      },
      {
        model: User,
        attributes: ['avatar', 'url', 'description'],
      },
      {
        model: Media,
      },
      {
        model: Tag,
        attributes: ['tagName'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 20,
    offset: req.body?.page ? req.body.page * 20 : 0,
  };
}

app.get('/', (req, res) => res.send(getIp(req)));

// serve static images
app.use('/uploads', express.static('uploads'));

app.post('/dashboard', authenticateToken, async (req: any, res) => {
  const posterId = req.jwtData.userId;
  const usersFollowed = await getFollowedsIds(posterId);
  const rawPostsByFollowed = await Post.findAll({
    where: {
      userId: {[Op.in]: usersFollowed},
      // date the user has started scrolling
      createdAt: {
        [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date(),
      },
    },
    ...getPostBaseQuery(req),
  });
  res.send(rawPostsByFollowed);
});

app.get('/getFollowedUsers', authenticateToken, async (req: any, res) => {
  res.send(await getFollowedsIds(req.jwtData.userId));
});

app.post('/notifications', authenticateToken, async (req: any, res) => {
  const userId = req.jwtData.userId;
  const userPosts = await getAllPostsIds(userId);
  const user = await User.findOne({
    where: {
      id: userId,
    },
  });
  const newReblogs = Post.findAll({
    where: {
      parentId: {[Op.in]: userPosts},
      createdAt: {
        [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date(),
      },
    },
  });
  const newFollows = user.getFollower({
    where: {
      createdAt: {
        [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date(),
      },

    },
    attributes: ['url', 'avatar'],
  });
  res.send({
    follows: await newFollows,
    reblogs: await newReblogs,
  });
});

app.post('/singlePost', async (req: any, res) => {
  let success = false;
  if (req.body && req.body.id) {
    const post = await Post.findOne({
      where: {
        id: req.body.id,
      },
      ...getPostBaseQuery(req),
    });
    res.send(post);
    success = true;
  }

  if (!success) {
    res.send({success: false});
  }
});

app.post('/blog', async (req: any, res) => {
  let success = false;
  if (req.body && req.body.id) {
    const blog = await (User.findOne({
      where: {
        url: sequelize.where(
            sequelize.fn('LOWER', sequelize.col('url')),
            'LIKE', req.body.id.toLowerCase()),
      },
    }));
    const blogId = blog?.id;
    if (blogId) {
      const postsByBlog = await Post.findAll({
        where: {
          userId: blogId,
          // date the user has started scrolling
          createdAt: {
            [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date(),
          },
        },
        ...getPostBaseQuery(req),
      });
      success = true;
      res.send(postsByBlog);
    }
  }

  if (!success) {
    res.send({success: false});
  }
});

app.post('/userDetails', async (req, res) => {
  let success = false;
  if (req.body && req.body.id) {
    const blog = await (User.findOne({
      attributes: {
        exclude: [
          'password',
          'birthDate',
          'email',
          'lastLoginIp',
          'registerIp',
          'activated',
          'activationCode',
          'requestedPasswordReset',
          'updatedAt',
        ],
      },
      where: {
        url: sequelize.where(
            sequelize.fn('LOWER', sequelize.col('url')),
            'LIKE', req.body.id.toLowerCase()),
      },
    }));
    success = true;
    res.send(blog);
  }

  if (!success) {
    res.send({success: false});
  }
});

app.post('/search', async (req, res) => {
  // const success = false;
  let users: any = [];
  let posts: any = [];
  const promises: Promise<any>[] = [];
  if (req.body && req.body.term) {
    const searchTerm = req.body.term.toLowerCase().trim();
    // we get the tag if exists then get posts from the tag
    // same way ass dashboard
    const tagSearch = await Tag.findOne({
      where: {
        tagName: searchTerm,
      },
    });
    if (tagSearch) {
      posts = tagSearch.getPosts({
        where: {
          // date the user has started scrolling
          createdAt: {
            [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date(),
          },
        },
        ...getPostBaseQuery(req),

      });
      promises.push(posts);
    }
    users = User.findAll({
      limit: 20,
      offset: req.body?.page ? req.body.page * 20 : 0,
      where: {
        activated: true,
        [Op.or]: [
          sequelize.where(
              sequelize.fn('LOWER', sequelize.col('url')),
              'LIKE', '%' + searchTerm + '%'),
          sequelize.where(
              sequelize.fn('LOWER', sequelize.col('description')),
              'LIKE', '%' + searchTerm + '%'),
        ],
      },
      attributes: {
        exclude: [
          'password',
          'birthDate',
          'email',
          'lastLoginIp',
          'registerIp',
          'activated',
          'activationCode',
          'requestedPasswordReset',
          'updatedAt',
        ],
      },

    });
    promises.push(users);
  }
  await Promise.all(promises);
  res.send({
    users: await users, posts: await posts,
  });
});


app.post('/register', async (req, res) => {
  let success = false;
  try {
    if (
      req.body &&
      req.body.email &&
      req.files &&
      req.files.length > 0 &&
      validateEmail(req.body.email) &&
      req.body.captchaResponse &&
      await checkCaptcha(req.body.captchaResponse, getIp(req),
      )
    ) {
      const emailExists = await User.findOne({
        where: {
          [Op.or]: [

            {email: req.body.email},

            sequelize.where(
                sequelize.fn('LOWER', sequelize.col('url')),
                'LIKE', '%' + req.body.url.toLowerCase().trim() + '%'),

          ],
        },
      });
      if (!emailExists) {
        const files: any = req.files;
        const activationCode = generateRandomString();
        let avatarURL = '/' + files[0].path;
        if (environment.removeFolderNameFromFileUploads) {
          avatarURL = avatarURL.slice('/uploads/'.length - 1);
        }
        const user = {
          email: req.body.email,
          description: req.body.description.trim(),
          url: req.body.url,
          NSFW: req.body.nsfw === 'true',
          // eslint-disable-next-line max-len
          password: await bcrypt.hash(req.body.password, environment.saltRounds),
          birthDate: new Date(req.body.birthDate),
          avatar: avatarURL,
          activated: false,
          registerIp: getIp(req),
          lastLoginIp: 'ACCOUNT_NOT_ACTIVATED',
          activationCode: activationCode,


        };
        const userWithEmail = User.create(user);
        if (environment.adminId) {
          const adminUser = await User.findOne({
            where: {
              id: environment.adminId,
            },
          });
          // follow staff!
          if (adminUser) {
            adminUser.addFollower(userWithEmail);
          }
        }
        const emailSent = sendActivationEmail(req.body.email, activationCode,
            'Welcome to wafrn!',
            '<h1>Welcome to wafrn</h1> To activate your account <a href="' +
            environment.frontendUrl + '/activate/' +
            encodeURIComponent(req.body.email) + '/' +
          activationCode + '">click here!</a>');
        await Promise.all([userWithEmail, emailSent]);
        success = true;
        res.send({
          success: true,
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
  if (!success) {
    res.statusCode = 401;
    res.send({success: false});
  }
});

app.post('/forgotPassword', async (req, res) => {
  const resetCode = generateRandomString();
  try {
    if (
      req.body &&
      req.body.email &&
      validateEmail(req.body.email) &&
      req.body.captchaResponse &&
      await checkCaptcha(req.body.captchaResponse, getIp(req))
    ) {
      const user = await User.findOne({
        where: {
          email: req.body.email,
        },
      });
      if (user) {
        user.activationCode = resetCode;
        user.requestedPasswordReset = new Date();
        user.save();
        // eslint-disable-next-line no-unused-vars
        const email = await sendActivationEmail(req.body.email, '',
            'So you forgot your wafrn password',
            '<h1>Use this link to reset your password</h1> Click <a href="' +
          environment.frontendUrl + '/resetPassword/' +
          encodeURIComponent(req.body.email) + '/' +
          resetCode + '">here</a> to reset your password',
        );
      }
    }
  } catch (error) {
    console.error(error);
  }

  res.send({success: true});
});

app.post('/activateUser', async (req, res) => {
  let success = false;
  if (
    req.body &&
    req.body.email &&
    validateEmail(req.body.email) &&
    req.body.code
  ) {
    const user = await User.findOne({
      where: {
        email: req.body.email,
        activationCode: req.body.code,
      },
    });
    if (user) {
      user.activated = true;
      user.save();
      success = true;
    }
  }

  res.send({
    success: success,
  });
});

app.post('/resetPassword', async (req, res) => {
  let success = false;

  try {
    if (
      req.body &&
      req.body.email &&
      req.body.code &&
      req.body.password &&
      validateEmail(req.body.email)
    ) {
      const resetPasswordDeadline = new Date();
      resetPasswordDeadline.setTime(
          resetPasswordDeadline.getTime() + 3600 * 2 * 1000,
      );
      const user = await User.findOne({
        where: {
          email: req.body.email,
          activationCode: req.body.code,
          requestedPasswordReset: {[Op.lt]: resetPasswordDeadline},

        },
      });
      if (user) {
        user.password =
          await bcrypt.hash(req.body.password, environment.saltRounds);
        user.requestedPasswordReset = null;
        user.save();
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

app.post('/login', async (req, res) => {
  let success = false;
  try {
    if (
      req.body &&
        req.body.email &&
        req.body.password &&
        req.body.captchaResponse &&
        await checkCaptcha(req.body.captchaResponse, getIp(req))
    ) {
      const userWithEmail = await User.findOne({where: {email: req.body.email}});
      if (userWithEmail) {
        const correctPassword =
            await bcrypt.compare(req.body.password, userWithEmail.password);
        if (correctPassword) {
          success = true;
          if (userWithEmail.activated) {
            res.send({
              success: true,
              token: jwt.sign(
                  {
                    userId: userWithEmail.id,
                    email: userWithEmail.email,
                    birthDate: userWithEmail.birthDate,
                    url: userWithEmail.url,
                  },
                  environment.jwtSecret, {expiresIn: '31536000s'}),
            });
            userWithEmail.lastLoginIp = getIp(req);
            userWithEmail.save();
          } else {
            res.send({
              success: false,
              errorMessage: 'Please activate your account! Check your email',
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
  }

  if (!success) {
    // res.statusCode = 401;
    res.send({
      success: false,
      errorMessage: 'Please recheck your email and password',
    });
  }
});


app.post('/uploadMedia', authenticateToken, async (req: any, res) => {
  const files: any = req.files;
  const picturesPromise: Array<any> = [];
  if (files && files.length > 0) {
    files.forEach((file: any) => {
      let fileUrl = '/' + file.path;
      if (environment.removeFolderNameFromFileUploads) {
        fileUrl = fileUrl.slice('/uploads/'.length - 1);
      }
      picturesPromise.push(Media.create({
        url: fileUrl,
        NSFW: req.body.nsfw === 'true',
        userId: req.jwtData.userId,
        description: req.body.description,
      }));
    });
  }
  const success = await Promise.all(picturesPromise);
  res.send(success);
});

app.post('/createPost', authenticateToken, async (req: any, res) => {
  // TODO check captcha
  let success = false;
  const posterId = req.jwtData.userId;
  try {
    if (
      req.body &&
      req.body.captchaKey &&
      await checkCaptcha(req.body.captchaKey, getIp(req) )
    ) {
      const content = req.body.content ? req.body.content.trim() : '';
      const post = await Post.create({
        content: content,
        NSFW: req.body.nsfw === 'true',
        userId: posterId,
      });

      // detect media in post

      // eslint-disable-next-line max-len
      const regex = /\[wafrnmediaid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm;
      // eslint-disable-next-line max-len
      const uuidRegex = /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/;
      const mediaInPost = req.body.content.match(regex);
      if (mediaInPost) {
        const mediaToAdd: String[] = [];
        mediaInPost.forEach((element: string) => {
          const mediaUUIDs = element.match(uuidRegex);
          if (mediaUUIDs) {
            const uuid = mediaUUIDs[0];
            if (mediaToAdd.indexOf(uuid) == -1) {
              mediaToAdd.push(uuid);
            }
          }
        });

        post.addMedias(mediaToAdd);
      }

      if (req.body.parent) {
        post.setParent(req.body.parent);
      }
      success = !req.body.tags;
      if (req.body.tags) {
        const tagListString = req.body.tags.toLowerCase();
        let tagList = tagListString.split(',');
        tagList = tagList.map((s: string) => s.trim());
        const existingTags = await Tag.findAll({
          where: {
            tagName: {
              [Op.in]: tagList,
            },
          },
        });

        const newTagPromises: Array<Promise<any>> = [];
        if (existingTags) {
          existingTags.forEach((existingTag: any) => {
            existingTag.addPost(post);
            tagList.splice(tagList.indexOf(existingTag.tagName), 1);
          });
        }

        tagList.forEach((newTag: string) => {
          newTagPromises.push(Tag.create({
            tagName: newTag,
          }));
        });

        const newTags = await Promise.all(newTagPromises);
        newTags.forEach((newTag) => {
          newTag.addPost(post);
        });
        success = true;
      }
      res.send(post);
    }
  } catch (error) {
    console.error(error);
  }
  if (!success) {
    res.statusCode = 400;
    res.send({success: false});
  }
});

/*
app.post('/myRecentMedia', authenticateToken, async (req: any, res) => {
  const recentMedia = await Media.findAll({
    where: {
      userId: req.jwtData.userId,
    },
    limit: 20,
    order: [['createdAt', 'DESC']],
    offset: req.body?.page ? req.body.page * 20 : 0,

  });
  res.send(recentMedia);
});

app.post('/reportPost', authenticateToken, async (req: any, res) => {

  let success = false;
  let report;
  const posterId = req.jwtData.userId;
  if (
    req.body &&
    req.body.postId &&
    req.body.severity &&
    req.body.description
  ) {
    report = await PostReport.create({
      resolved: false,
      severity: req.body.severity,
      description: req.body.description,
      userId: posterId,
      postId: req.body.postId,
    });
    success = true;
    res.send(report);
  }
  if (!success) {
    res.send({
      success: false,
    });
  }
});


app.post('/reportUser', authenticateToken, async (req: any, res) => {

  let success = false;
  let report;
  const posterId = req.jwtData.userId;
  if (
    req.body &&
    req.body.userId &&
    req.body.severity &&
    req.body.description
  ) {
    report = await PostReport.create({
      resolved: false,
      severity: req.body.severity,
      description: req.body.description,
      reporterId: posterId,
      reportedId: req.body.userId,
    });
    success = true;
    res.send(report);
  }
  if (!success) {
    res.send({
      success: false,
    });
  }
});
*/

app.post('/follow', authenticateToken, async (req: any, res) => {
  let success = false;
  try {
    const posterId = req.jwtData.userId;
    if (req.body && req.body.userId) {
      const userFollowed = await User.findOne({
        where: {
          id: req.body.userId,
        },
      });

      userFollowed.addFollower(posterId);
      success = true;
    }
  } catch (error) {
    console.error(error);
  }

  res.send({
    success: success,
  });
});

app.post('/unfollow', authenticateToken, async (req: any, res) => {
  let success = false;
  try {
    const posterId = req.jwtData.userId;
    if (req.body && req.body.userId) {
      const userUnfollowed = await User.findOne({
        where: {
          id: req.body.userId,
        },
      });

      userUnfollowed.removeFollower(posterId);
      success = true;
    }
  } catch (error) {
    console.error(error);
  }

  res.send({
    success: success,
  });
});


/*

app.post('/block', authenticateToken, async (req: any, res) => {
  let success = false;
  const posterId = req.jwtData.userId;
  if (req.body && req.body.userId) {
    const userBlocked = await User.findOne({
      where: {
        id: req.body.userId,
      },
    });

    userBlocked.addBlocker(posterId);
    userBlocked.removeFollowed(posterId);
    success = true;
  }

  res.send({
    success: success,
  });
});


app.post('/unblock', authenticateToken, async (req: any, res) => {
  let success = false;
  const posterId = req.jwtData.userId;
  if (req.body && req.body.userId) {
    const userUnblocked = await User.findOne({
      where: {
        id: req.body.userId,
      },
    });

    userUnblocked.removeBlocker(posterId);
    success = true;
  }

  res.send({
    success: success,
  });
});

*/

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});
