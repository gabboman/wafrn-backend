import { Application, Response } from 'express'
import { Op, Sequelize } from 'sequelize'
import { Blocks, Emoji, FederatedHost, Follows, Mutes, ServerBlock, User, UserOptions } from '../db'
import { authenticateToken } from '../utils/authenticateToken'

import generateRandomString from '../utils/generateRandomString'
import getIp from '../utils/getIP'
import sendActivationEmail from '../utils/sendActivationEmail'
import validateEmail from '../utils/validateEmail'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { sequelize } from '../db'

import optimizeMedia from '../utils/optimizeMedia'
import uploadHandler from '../utils/uploads'
import { generateKeyPairSync } from 'crypto'
import { environment } from '../environment'
import { logger } from '../utils/logger'
import { createAccountLimiter, loginRateLimiter } from '../utils/rateLimiters'
import fs from 'fs/promises'
import AuthorizedRequest from '../interfaces/authorizedRequest'
import optionalAuthentication from '../utils/optionalAuthentication'
import checkIpBlocked from '../utils/checkIpBlocked'
import { redisCache } from '../utils/redis'

const forbiddenCharacters = [':', '@', '/', '<', '>', '"']

export default function userRoutes(app: Application) {
  app.post(
    '/api/register',
    checkIpBlocked,
    createAccountLimiter,
    uploadHandler().single('avatar'),
    async (req, res) => {
      let success = false
      try {
        if (
          req.body?.email &&
          req.body.url &&
          !forbiddenCharacters.some((char) => req.body.url.includes(char)) &&
          validateEmail(req.body.email)
        ) {
          const emailExists = await User.findOne({
            where: {
              [Op.or]: [
                { email: req.body.email.toLowerCase() },
                sequelize.where(
                  sequelize.fn('LOWER', sequelize.col('url')),
                  'LIKE',
                  req.body.url.toLowerCase().trim().replace(' ', '_')
                )
              ]
            }
          })
          if (!emailExists) {
            let avatarURL = '/uploads/default.webp'
            if (req.file != null) {
              avatarURL = `/${await optimizeMedia(req.file.path)}`
            }
            if (environment.removeFolderNameFromFileUploads) {
              avatarURL = avatarURL.slice('/uploads/'.length - 1)
            }
            const activationCode = generateRandomString()
            const { publicKey, privateKey } = generateKeyPairSync('rsa', {
              modulusLength: 4096,
              publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
              },
              privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
              }
            })
            const user = {
              email: req.body.email.toLowerCase(),
              description: req.body.description.trim(),
              url: req.body.url.trim().replace(' ', '_'),
              name: req.body.name ? req.body.name : req.body.url.trim().replace(' ', '_'),
              NSFW: req.body.nsfw === 'true',
              password: await bcrypt.hash(req.body.password, environment.saltRounds),
              birthDate: new Date(req.body.birthDate),
              avatar: avatarURL,
              activated: false,
              registerIp: getIp(req),
              lastLoginIp: 'ACCOUNT_NOT_ACTIVATED',
              banned: false,
              activationCode,
              privateKey,
              publicKey
            }

            const userWithEmail = User.create(user)
            const mailHeader = environment.reviewRegistrations
              ? 'We are reviewing your profile'
              : `Welcome to ${environment.instanceUrl}!`
            const mailBody = environment.reviewRegistrations
              ? `Hello ${req.body.url}, at this moment we are manually reviewing registrations. You will recive an email from us once it's accepted`
              : `<h1>Welcome to ${environment.instanceUrl}</h1> To activate your account <a href="${
                  environment.instanceUrl
                }/activate/${encodeURIComponent(req.body.email.toLowerCase())}/${activationCode}">click here!</a>`
            const emailSent = sendActivationEmail(req.body.email.toLowerCase(), activationCode, mailHeader, mailBody)
            await Promise.all([userWithEmail, emailSent])
            success = true
            await redisCache.del('allLocalUserIds')
            res.send({
              success: true
            })
          } else {
            logger.info({
              message: 'Email exists',
              email: req.body?.email,
              url: req.body.url,
              forbidChar: !forbiddenCharacters.some((char) => req.body.url.includes(char)),
              emailValid: validateEmail(req.body.email)
            })
          }
        } else {
          logger.info({
            message: 'Failed registration',
            email: req.body?.email,
            url: req.body.url,
            forbidChar: !forbiddenCharacters.some((char) => req.body.url.includes(char)),
            emailValid: validateEmail(req.body.email)
          })
        }
      } catch (error) {
        console.log(error)
        logger.error(error)
      }
      if (!success) {
        res.statusCode = 401
        res.send({ success: false })
      }
    }
  )

  app.post('/api/updateCSS', authenticateToken, async (req: AuthorizedRequest, res: Response) => {
    const posterId = req.jwtData?.userId
    if (req.body.css) {
      try {
        await fs.writeFile(`uploads/themes/${posterId}.css`, req.body.css)
        res.send({ success: true })
      } catch (error) {
        logger.warn(error)
        res.status(500)
        res.send({ error: true })
      }
    } else {
      res.sendStatus(500)
    }
  })

  app.post(
    '/api/editProfile',
    authenticateToken,
    uploadHandler().single('avatar'),
    async (req: AuthorizedRequest, res: Response) => {
      let success = false
      try {
        const posterId = req.jwtData?.userId as string
        const user = await User.findOne({
          where: {
            id: posterId
          }
        })
        if (req.body) {
          if (req.body.description) {
            user.description = req.body.description
          }

          if (req.body.federateWithThreads) {
            const federateWithThreadsKey = 'wafrn.federateWithThreads'
            const federateWithThreads = req.body.federateWithThreads
            let federateWithThreadsOption = await UserOptions.findOne({
              where: {
                userId: posterId,
                optionName: federateWithThreadsKey
              }
            })
            if (federateWithThreadsOption) {
              federateWithThreadsOption.optionValue = federateWithThreads
              await federateWithThreadsOption.save()
            } else {
              federateWithThreadsOption = await UserOptions.create({
                userId: posterId,
                optionName: federateWithThreadsKey,
                optionValue: federateWithThreads
              })
            }
          }

          if (req.body.defaultPostEditorPrivacy) {
            const defaultPostEditorPrivacyKey = 'wafrn.defaultPostEditorPrivacy'
            const defaultPostEditorPrivacy = req.body.defaultPostEditorPrivacy
            let dbDefaultPostEditorPrivacy = await UserOptions.findOne({
              where: {
                userId: posterId,
                optionName: defaultPostEditorPrivacyKey
              }
            })
            if (dbDefaultPostEditorPrivacy) {
              dbDefaultPostEditorPrivacy.optionValue = defaultPostEditorPrivacy
              await dbDefaultPostEditorPrivacy.save()
            } else {
              dbDefaultPostEditorPrivacy = await UserOptions.create({
                userId: posterId,
                optionName: defaultPostEditorPrivacyKey,
                optionValue: defaultPostEditorPrivacy
              })
            }
            redisCache.del(`userOptions:${posterId}`)
          }

          if (req.body.name) {
            user.name = req.body.name
          }

          if (req.file != null) {
            let avatarURL = `/${optimizeMedia(req.file.path)}`
            if (environment.removeFolderNameFromFileUploads) {
              avatarURL = avatarURL.slice('/uploads/'.length - 1)
              user.avatar = avatarURL
            }
          }
          await user.save()
          success = true
        }
      } catch (error) {
        logger.error(error)
      }

      res.send({
        success
      })
    }
  )

  app.post('/api/forgotPassword', checkIpBlocked, createAccountLimiter, async (req, res) => {
    const resetCode = generateRandomString()
    try {
      if (req.body?.email && validateEmail(req.body.email)) {
        const user = await User.findOne({
          where: {
            email: req.body.email.toLowerCase()
          }
        })
        if (user) {
          user.activationCode = resetCode
          user.requestedPasswordReset = new Date()
          user.save()
          // eslint-disable-next-line no-unused-vars
          const email = await sendActivationEmail(
            req.body.email.toLowerCase(),
            '',
            `So you forgot your ${environment.instanceUrl} password`,
            `<h1>Use this link to reset your password</h1> Click <a href="${
              environment.instanceUrl
            }/resetPassword/${encodeURIComponent(
              req.body.email.toLowerCase()
            )}/${resetCode}">here</a> to reset your password`
          )
        }
      }
    } catch (error) {
      logger.error(error)
    }

    res.send({ success: true })
  })

  app.post('/api/activateUser', checkIpBlocked, async (req, res) => {
    let success = false
    if (req.body?.email && validateEmail(req.body.email) && req.body.code && !environment.reviewRegistrations) {
      const user = await User.findOne({
        where: {
          email: req.body.email.toLowerCase(),
          activationCode: req.body.code
        }
      })
      if (user) {
        user.activated = true
        user.save()
        success = true
      }
    }

    res.send({
      success
    })
  })

  app.post('/api/resetPassword', checkIpBlocked, async (req, res) => {
    let success = false

    try {
      if (req.body?.email && req.body.code && req.body.password && validateEmail(req.body.email)) {
        const resetPasswordDeadline = new Date()
        resetPasswordDeadline.setTime(resetPasswordDeadline.getTime() + 3600 * 2 * 1000)
        const user = await User.findOne({
          where: {
            email: req.body.email.toLowerCase(),
            activationCode: req.body.code,
            requestedPasswordReset: { [Op.lt]: resetPasswordDeadline }
          }
        })
        if (user) {
          user.password = await bcrypt.hash(req.body.password, environment.saltRounds)
          user.activated = environment.reviewRegistrations ? user.activated : true
          user.requestedPasswordReset = null
          user.save()
          success = true
        }
      }
    } catch (error) {
      logger.error(error)
    }

    res.send({
      success
    })
  })

  app.post('/api/login', checkIpBlocked, loginRateLimiter, async (req, res) => {
    let success = false
    try {
      if (req.body?.email && req.body.password) {
        const userWithEmail = await User.findOne({
          where: {
            email: req.body.email.toLowerCase(),
            banned: {
              [Op.ne]: true
            }
          }
        })
        if (userWithEmail) {
          const correctPassword = await bcrypt.compare(req.body.password, userWithEmail.password)
          if (correctPassword) {
            success = true
            if (userWithEmail.activated) {
              res.send({
                success: true,
                token: jwt.sign(
                  {
                    userId: userWithEmail.id,
                    email: userWithEmail.email.toLowerCase(),
                    birthDate: userWithEmail.birthDate,
                    url: userWithEmail.url,
                    role: userWithEmail.role
                  },
                  environment.jwtSecret,
                  { expiresIn: '31536000s' }
                )
              })
              userWithEmail.lastLoginIp = getIp(req)
              userWithEmail.save()
            } else {
              res.send({
                success: false,
                errorMessage: 'Please activate your account! Check your email'
              })
            }
          }
        }
      }
    } catch (error) {
      logger.error(error)
    }

    if (!success) {
      // res.statusCode = 401;
      res.send({
        success: false,
        errorMessage: 'Please recheck your email and password'
      })
    }
  })

  app.get('/api/user', checkIpBlocked, optionalAuthentication, async (req: AuthorizedRequest, res) => {
    let success = false
    if (req.query?.id) {
      const blogId: string = (req.query.id || '').toString().toLowerCase().trim()
      const blog = await User.findOne({
        attributes: ['id', 'url', 'name', 'description', 'remoteId', 'avatar', 'federatedHostId', 'headerImage'],
        include: [
          {
            model: Emoji,
            required: false
          },
          {
            model: FederatedHost,
            required: false
          }
        ],
        where: {
          url: sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', blogId),
          banned: false
        }
      })
      let followed = Follows.count({
        where: {
          followedId: blog.id,
          accepted: true
        }
      })
      let followers = Follows.count({
        where: {
          followerId: blog.id,
          accepted: true
        }
      })
      let muted = false
      let blocked = false
      let serverBlocked = false || blog?.federatedHost?.blocked
      if (req.jwtData?.userId && blog) {
        const mutedQuery = Mutes.count({
          where: {
            muterId: req.jwtData.userId,
            mutedId: blog.id
          }
        })
        const blockedQuery = Blocks.count({
          where: {
            blockerId: req.jwtData.userId,
            blockedId: blog.id
          }
        })
        const serverBlockedQuery = await ServerBlock.count({
          where: {
            userBlockerId: req.jwtData.userId,
            blockedServerId: blog.federatedHostId
          }
        })
        await Promise.all([mutedQuery, blockedQuery, serverBlockedQuery, followed, followers])
        muted = (await mutedQuery) === 1
        blocked = (await blockedQuery) === 1
        serverBlocked = serverBlocked || (await serverBlockedQuery) === 1
      } else {
        await Promise.all([followed, followers])
      }

      followed = await followed
      followers = await followers
      success = blog
      if (success) {
        res.send({ ...blog.dataValues, muted, blocked, serverBlocked, followed, followers })
      }
    }

    if (!success) {
      res.send({ success: false })
    }
  })
}
