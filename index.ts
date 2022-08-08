/* eslint-disable max-len */
/* eslint-disable require-jsdoc */

import express from 'express';
import {
  User,
  Post,
  PostReport,
  PostView,
  Tag,
  Media,
  PostMentionsUserRelation,
} from './models';

const Sequelize = require('sequelize');

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
    cb(null, Date.now() + '_' + randomText + '.' + extension.toLowerCase());
  },
});

const upload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10000000, // 10000000 Bytes = 10 MB.
  },
  fileFilter(req, file, cb) {
    if (
      !(
        req.files &&
        req.files?.length <= 1 &&
        (req.url === '/uploadMedia' ||
          req.url === '/register' ||
          req.url === '/editProfile') &&
        req.method === 'POST' &&
        file.originalname
            .toLowerCase()
            .match(/\.(png|jpg|jpeg|gifv|gif|webp|mp4)$/)
      )
    ) {
      cb(null, false);
      return cb(new Error('There was an error with the upload'));
    }
    cb(null, true);
  },
});
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport(environment.emailConfig);

// rest of the code remains same
const app = express();
const PORT = environment.port;

// TODO fix this!
app.use(upload.any());
app.use(cors());
const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging: environment.logSQLQueries ? console.log : false,
});

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

export interface HCaptchaSiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

async function checkCaptcha(response: string, ip: string): Promise<boolean> {
  let res = false;
  const secretKey = environment.captchaPrivateKey;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${response}&remoteip=${ip}`;
  const googleResponse = await request(url);
  res = JSON.parse(googleResponse).success;
  return res;
}

function getIp(petition: any): string {
  return (
    petition.header('x-forwarded-for') || petition.connection.remoteAddress
  );
}
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(
      token,
    environment.jwtSecret as string,
    (err: any, jwtData: any) => {
      if (err) return res.sendStatus(403);

      req.jwtData = jwtData;

      next();
    },
  );
}

function validateEmail(email: string) {
  const res =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return res.test(String(email).toLowerCase());
}

function generateRandomString() {
  return crypto
      .createHash('sha1')
      .update(Math.random().toString())
      .digest('hex');
}

async function sendActivationEmail(
    email: string,
    code: string,
    subject: string,
    contents: string,
) {
  // const activateLink = code;
  return await transporter.sendMail({
    from: environment.emailConfig.auth.from,
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
            attributes: ['id', 'NSFW', 'description', 'url'],
          },
          {
            model: Tag,
            attributes: ['tagName'],
          },
          {
            model: PostMentionsUserRelation,
            attributes: ['userId'],
            include: [
              {
                model: User,
                attributes: ['avatar', 'url', 'description'],
              },
            ],
          },
        ],
      },
      {
        model: User,
        attributes: ['avatar', 'url', 'description'],
      },
      {
        model: Media,
        attributes: ['id', 'NSFW', 'description', 'url'],
      },
      {
        model: Tag,
        attributes: ['tagName'],
      },
      {
        model: PostMentionsUserRelation,
        attributes: ['userId'],
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 20,
    offset: req.body?.page ? req.body.page * 20 : 0,
  };
}

app.get('/', (req, res) =>
  res.send({
    status: true,
    readme:
      'welcome to the wafrn api, you better check https://github.com/gabboman/wafrn to figure out where to poke :D',
  }),
);

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
        [Op.lt]: req.body?.startScroll ?
          new Date().setTime(req.body.startScroll) :
          new Date(),
      },
    },
    ...getPostBaseQuery(req),
  });
  res.send(rawPostsByFollowed);
});

app.post('/explore', async (req: any, res) => {
  const rawPosts = await Post.findAll({
    where: {
      // date the user has started scrolling
      createdAt: {
        [Op.lt]: req.body?.startScroll ?
          new Date().setTime(req.body.startScroll) :
          new Date(),
      },
    },
    ...getPostBaseQuery(req),
  });
  res.send(rawPosts);
});

app.get('/getFollowedUsers', authenticateToken, async (req: any, res) => {
  const followedUsers = getFollowedsIds(req.jwtData.userId);
  const blockedUsers = getBlockedids(req.jwtData.userId);
  await Promise.all([followedUsers, blockedUsers]);
  res.send({
    followedUsers: await followedUsers,
    blockedUsers: await blockedUsers,
  });
});

app.post('/readNotifications', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.jwtData.userId;
    const user = await User.findOne({
      where: {
        id: userId,
      },
    });
    if (req.body.time) {
      user.lastTimeNotificationsCheck = new Date().setTime(req.body.time);
      user.save();
    }
  } catch (error) {
    console.error(error);
  }
  res.send({
    success: true,
  });
});

async function getReblogs(user: any) {
  const userId = user.id;
  const userPostsWithReblogs = await Post.findAll({
    include: [
      {
        model: Post,
        as: 'descendents',
        where: {
          createdAt: {
            [Op.gt]: new Date(user.lastTimeNotificationsCheck),
          },
        },
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description', 'id'],
          },
          {
            model: Media,
            attributes: ['id', 'NSFW', 'description', 'url'],
          },
        ],
      },
      {
        model: User,
        attributes: ['avatar', 'url', 'description'],
      },
      {
        model: Media,
        attributes: ['id', 'NSFW', 'description', 'url'],
      },
      {
        model: Tag,
        attributes: ['tagName'],
      },
    ],
    where: {
      userId: userId,
    },
  });
  const result: any[] = [];
  userPostsWithReblogs.forEach((postWithReblogs: any) => {
    try {
      postWithReblogs.descendents.forEach((elem: any) => {
        // TODO fix dirty hack
        const elemProcessed: any = JSON.parse(JSON.stringify(elem));
        elemProcessed['createdAt'] = elem.createdAt.getTime();
        result.push(elemProcessed);
      });
    } catch (error) {
      console.error(error);
    }
  });
  return result;
}

app.post('/notifications', authenticateToken, async (req: any, res) => {
  const userId = req.jwtData.userId;
  const user = await User.findOne({
    where: {
      id: userId,
    },
  });
  const blockedUsers = await getBlockedids(userId);
  const perPostReblogs = getReblogs(user);
  const newFollows = user.getFollower({
    where: {
      createdAt: {
        [Op.gt]: new Date(user.lastTimeNotificationsCheck),
      },
    },
    attributes: ['url', 'avatar'],
  });
  const newMentions = PostMentionsUserRelation.findAll({
    where: {
      createdAt: {
        [Op.gt]: new Date(user.lastTimeNotificationsCheck),
      },
      userId: userId,
    },
    include: [
      {
        model: Post,
        include: [
          {
            model: User,
            attributes: ['avatar', 'url', 'description', 'id'],
          },
        ],
      },
    ],
  });
  res.send({
    follows: (await newFollows).filter(
        (newFollow: any) => blockedUsers.indexOf(newFollow.id) == -1,
    ),
    reblogs: (await perPostReblogs).filter(
        (newReblog: any) => blockedUsers.indexOf(newReblog.user.id) == -1,
    ),
    mentions: (await newMentions)
        .filter(
            (newMention: any) => blockedUsers.indexOf(newMention.post.userId) == -1,
        )
        .map((mention: any) => {
          return {
            user: mention.post.user,
            content: mention.post.content,
            id: mention.post.id,
            createdAt: mention.createdAt,
            parentId: mention.post.parentId,
          };
        }),
  });
});

app.post('/postDetails', async (req: any, res) => {
  let success = false;
  try {
    if (req.body && req.body.id) {
      const post = await Post.findOne({
        where: {
          id: req.body.id,
        },
      });
      if (post) {
        const totalReblogs = await post.getDescendents();
        res.send({reblogs: totalReblogs.length});
        PostView.create({
          postId: req.body.id,
        });
        success = true;
      }
    }
  } catch (error) {
    console.log(error);
  }
  if (!success) {
    res.send({
      success: false,
    });
  }
});

app.get('/singlePost/:id', async (req: any, res) => {
  let success = false;
  if (req.params && req.params.id) {
    const post = await Post.findOne({
      where: {
        id: req.params.id,
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
    const blog = await User.findOne({
      where: {
        url: sequelize.where(
            sequelize.fn('LOWER', sequelize.col('url')),
            'LIKE',
            req.body.id.toLowerCase(),
        ),
      },
    });
    const blogId = blog?.id;
    if (blogId) {
      const postsByBlog = await Post.findAll({
        where: {
          userId: blogId,
          // date the user has started scrolling
          createdAt: {
            [Op.lt]: req.body?.startScroll ?
              new Date().setTime(req.body.startScroll) :
              new Date(),
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
    const blog = await User.findOne({
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
          'createdAt',
          'lastTimeNotificationsCheck',
        ],
      },
      where: {
        url: sequelize.where(
            sequelize.fn('LOWER', sequelize.col('url')),
            'LIKE',
            req.body.id.toLowerCase(),
        ),
      },
    });
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
            [Op.lt]: req.body?.startScroll ?
              new Date().setTime(req.body.startScroll) :
              new Date(),
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
              'LIKE',
              '%' + searchTerm + '%',
          ),
          sequelize.where(
              sequelize.fn('LOWER', sequelize.col('description')),
              'LIKE',
              '%' + searchTerm + '%',
          ),
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
          'createdAt',
          'lastTimeNotificationsCheck',
        ],
      },
    });
    promises.push(users);
  }
  await Promise.all(promises);
  res.send({
    users: await users,
    posts: await posts,
  });
});

app.get('/userSearch/:term', async (req, res) => {
  // const success = false;
  let users: any = [];
  const searchTerm = req.params.term.toLowerCase().trim();
  users = User.findAll({
    limit: 5,
    where: {
      activated: true,
      [Op.or]: [
        sequelize.where(
            sequelize.fn('LOWER', sequelize.col('url')),
            'LIKE',
            '%' + searchTerm + '%',
        ),
      ],
    },
    attributes: ['url', 'avatar', 'id'],
  });

  res.send({
    users: await users,
  });
});

app.post('/register', async (req, res) => {
  let success = false;
  try {
    if (
      req.body &&
      req.body.email &&
      // req.files &&
      // req.files.length > 0 &&
      validateEmail(req.body.email) &&
      req.body.captchaResponse &&
      (await checkCaptcha(req.body.captchaResponse, getIp(req)))
    ) {
      const emailExists = await User.findOne({
        where: {
          [Op.or]: [
            {email: req.body.email},

            sequelize.where(
                sequelize.fn('LOWER', sequelize.col('url')),
                'LIKE',
                '%' + req.body.url.toLowerCase().trim() + '%',
            ),
          ],
        },
      });
      if (!emailExists) {
        let avatarURL = '/uploads/default.png';
        const activationCode = generateRandomString();
        if (req.files && req.files.length > 0) {
          const files: any = req.files;
          avatarURL = '/' + files[0].path;
        }
        if (environment.removeFolderNameFromFileUploads) {
          avatarURL = avatarURL.slice('/uploads/'.length - 1);
        }
        const user = {
          email: req.body.email,
          description: req.body.description.trim(),
          url: req.body.url,
          NSFW: req.body.nsfw === 'true',

          password: await bcrypt.hash(
              req.body.password,
              environment.saltRounds,
          ),
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
        const emailSent = sendActivationEmail(
            req.body.email,
            activationCode,
            'Welcome to wafrn!',
            '<h1>Welcome to wafrn</h1> To activate your account <a href="' +
            environment.frontendUrl +
            '/activate/' +
            encodeURIComponent(req.body.email) +
            '/' +
            activationCode +
            '">click here!</a>',
        );
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

app.post('/editProfile', authenticateToken, async (req: any, res) => {
  let success = false;
  try {
    const posterId = req.jwtData.userId;
    const user = await User.findOne({
      where: {
        id: posterId,
      },
    });
    if (req.body) {
      if (req.body.description) {
        user.description = req.body.description;
      }
      if (req.files?.length > 0) {
        let avatarURL = '/' + req.files[0].path;
        if (environment.removeFolderNameFromFileUploads) {
          avatarURL = avatarURL.slice('/uploads/'.length - 1);
          user.avatar = avatarURL;
        }
      }
      user.save();
      success = true;
    }
  } catch (error) {
    console.error(error);
  }

  res.send({
    success: success,
  });
});

app.post('/forgotPassword', async (req, res) => {
  const resetCode = generateRandomString();
  try {
    if (
      req.body &&
      req.body.email &&
      validateEmail(req.body.email) &&
      req.body.captchaResponse &&
      (await checkCaptcha(req.body.captchaResponse, getIp(req)))
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
        const email = await sendActivationEmail(
            req.body.email,
            '',
            'So you forgot your wafrn password',
            '<h1>Use this link to reset your password</h1> Click <a href="' +
            environment.frontendUrl +
            '/resetPassword/' +
            encodeURIComponent(req.body.email) +
            '/' +
            resetCode +
            '">here</a> to reset your password',
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
        user.password = await bcrypt.hash(
            req.body.password,
            environment.saltRounds,
        );
        user.activated = 1;
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
      (await checkCaptcha(req.body.captchaResponse, getIp(req)))
    ) {
      const userWithEmail = await User.findOne({
        where: {email: req.body.email},
      });
      if (userWithEmail) {
        const correctPassword = await bcrypt.compare(
            req.body.password,
            userWithEmail.password,
        );
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
                  environment.jwtSecret,
                  {expiresIn: '31536000s'},
              ),
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

app.post('/createPost', authenticateToken, async (req: any, res) => {
  let success = false;
  const posterId = req.jwtData.userId;
  try {
    if (
      req.body &&
      req.body.captchaKey &&
      (await checkCaptcha(req.body.captchaKey, getIp(req)))
    ) {
      const content = req.body.content ? req.body.content.trim() : '';
      const post = await Post.create({
        content: content,
        NSFW: req.body.nsfw === 'true',
        userId: posterId,
      });

      // detect media in post

      const wafrnMediaRegex =
        /\[wafrnmediaid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm;

      const mentionRegex =
        /\[mentionuserid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm;

      const uuidRegex =
        /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/;
      const mediaInPost = req.body.content.match(wafrnMediaRegex);
      const mentionsInPost = req.body.content.match(mentionRegex);
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

      if (mentionsInPost) {
        const mentionsToAdd: String[] = [];
        mentionsInPost.forEach((elem: string) => {
          const mentionedUserUUID = elem.match(uuidRegex);

          if (
            mentionedUserUUID &&
            mentionedUserUUID[0] !== null &&
            mentionsToAdd.indexOf(mentionedUserUUID[0]) == -1
          ) {
            mentionsToAdd.push(mentionedUserUUID[0]);
          }
        });
        mentionsToAdd.forEach((mention) => {
          PostMentionsUserRelation.create({
            userId: mention,
            postId: post.id,
          });
        });
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
          newTagPromises.push(
              Tag.create({
                tagName: newTag,
              }),
          );
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

app.post('/reportPost', authenticateToken, async (req: any, res) => {
  let success = false;
  let report;
  try {
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
  } catch (error) {
    console.error(error);
  }
  if (!success) {
    res.send({
      success: false,
    });
  }
});

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

app.post('/block', authenticateToken, async (req: any, res) => {
  let success = false;
  try {
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
  } catch (error) {
    console.error(error);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});
