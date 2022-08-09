import {Application} from 'express';
import {Op} from 'sequelize';
import {User} from '../models';
import authenticateToken from '../utils/authenticateToken';
import checkCaptcha from '../utils/checkCaptcha';
import generateRandomString from '../utils/generateRandomString';
import getIp from '../utils/getIP';
import sendActivationEmail from '../utils/sendActivationEmail';
import validateEmail from '../utils/validateEmail';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export default function userRoutes(app: Application) {
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
}
