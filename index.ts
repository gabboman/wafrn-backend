'use strict';


import express from 'express';

const Sequelize = require('sequelize');
//sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize);

// operators
const { Op } = require("sequelize");
const environment = require('./environment');
var crypto = require('crypto');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
import bodyParser, { BodyParser } from 'body-parser';

import multer from 'multer';
const imageStorage = multer.diskStorage({
    // Destination to store image     
    destination: 'uploads',
    filename: (req, file, cb) => {
        let originalNameArray = file.originalname.split('.');
        let extension = originalNameArray[originalNameArray.length - 1];
        let randomText = generateRandomString();
        cb(null, Date.now() + '_' + randomText + '.' + extension);

    }
});

const upload = multer({
    storage: imageStorage,
    limits: {
        fileSize: 10000000 // 10000000 Bytes = 10 MB.
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg|jpeg|gifv|gif|webp)$/)) {
            // upload only png and jpg format
            return cb(new Error('Please upload a Image'))
        }
        cb(null, true)
    }
});
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport(
    environment.emailConfig
);

// rest of the code remains same
const app = express();
const PORT = 8000;

app.use(upload.any());
const sequelize = new Sequelize(environment.databaseConnectionString);

const User = sequelize.define('users', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
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
    // we use activationCode both for activating the account and for reseting the password
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
        primaryKey: true
    },
    NSFW: Sequelize.BOOLEAN,
    content: Sequelize.TEXT
});

const Tag = sequelize.define('tags', {
    // NSFW: Sequelize.BOOLEAN,
    tagName: Sequelize.TEXT
});

const Media = sequelize.define('medias', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
    },
    NSFW: Sequelize.BOOLEAN,
    description: Sequelize.TEXT,
    url: Sequelize.TEXT,
});

const PostReport = sequelize.define('postReports', {
    resolved: Sequelize.BOOLEAN,
    severity: Sequelize.INTEGER,
    description: Sequelize.TEXT
});

const UserReport = sequelize.define('userReports', {
    resolved: Sequelize.BOOLEAN,
    severity: Sequelize.INTEGER,
    description: Sequelize.TEXT

});



User.belongsToMany(User, {
    through: 'follows',
    as: 'followed',
    foreignKey: 'followedId'
});

User.belongsToMany(User, {
    through: 'follows',
    as: 'follower',
    foreignKey: 'followerId'
});

User.belongsToMany(User, {
    through: 'blocks',
    as: 'blocker',
    foreignKey: 'blockerId'
});

User.belongsToMany(User, {
    through: 'blocks',
    as: 'blocked',
    foreignKey: 'blockedId'
});

PostReport.belongsTo(User);
PostReport.belongsTo(Post);

UserReport.belongsTo(User, { foreignKey: 'ReporterId' })
UserReport.belongsTo(User, { foreignKey: 'ReportedId' })

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
    through: 'postMediaRelations'
});
Post.belongsToMany(Media, {
    through: 'postMediaRelations'
})


sequelize.sync({
    force: environment.forceSync,
    logging: environment.prod
})
    .then(async () => {
        console.log(`Database & tables ready!`);
        if (environment.forceSync) {
            console.log('CLEANING DATA');
            // seeder();

        }
    });


function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (token == null) return res.sendStatus(401)

    jwt.verify(token, environment.jwtSecret as string, (err: any, jwtData: any) => {

        if (err) return res.sendStatus(403)

        req.jwtData = jwtData

        next()
    })
}


function validateEmail(email: string) {
    const res = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return res.test(String(email).toLowerCase());
}

function generateRandomString() {
    return crypto.createHash('sha1').update(Math.random().toString()).digest("hex");
}

function getPetitionIp(req: any): string {
    let res = '';

    return res;
}

async function sendActivationEmail(email: string, code: string, subject: string, contents: string) {
    let activateLink = code;
    return await transporter.sendMail({
        from: environment.emailConfig.auth.user,
        to: email,
        subject: subject,
        html: contents,
    });

}

async function getFollowersIds(userId: string): Promise<string[]> {
    let usr = await User.findOne({
        where: {
            id: userId
        },
        attributes: ['id']
    });
    let followed = await usr.getFollowed();
    let result = followed.map((followed: any) => followed.id);
    return result;


}

function getPostBaseQuery(req: any) {
    return {
        include: [{ model: Post, as: 'ancestors', include: [{ model: User, attributes: ['avatar', 'url', 'description'] }, { model: Media }] }, { model: User, attributes: ['avatar', 'url', 'description'] }, { model: Media }],
        order: [['createdAt', 'DESC']],
        limit: 20,
        offset: req.body?.page ? req.body.page * 20 : 0
    }
}

app.get('/', (req, res) => res.send('Welcome to WAFRN API.'));

// serve static images
app.use('/uploads', express.static('uploads'));

app.post('/dashboard', authenticateToken, async (req: any, res) => {
    const posterId = req.jwtData.userId;
    const usersFollowed = await getFollowersIds(posterId);
    const rawPostsByFollowed = await Post.findAll({
        where: {
            userId: { [Op.in]: usersFollowed },
            //date the user has started scrolling
            createdAt: { [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date() }
        },
        ...getPostBaseQuery(req)
    });
    res.send(rawPostsByFollowed)
});

app.post('/singlePost', async (req: any, res) => {
    let success = false;
    if(req.body && req.body.id) {
        const post = await Post.findOne({
            where: {
                id: req.body.id
            },
            ...getPostBaseQuery(req)
        });
        res.send(post);
        success = true;
    }

    if(!success) {
        res.send({success: false})
    }
    
});

app.post('/blog', async (req: any, res) => {

    let success = false;
    if(req.body && req.body.id) {
        let blogId = await (User.findOne({
            url: req.body.id.toLowerCase()
        })).id;
        if(blogId){
            const postsByBlog = await Post.findAll({
                where: {
                    userId:  blogId ,
                    //date the user has started scrolling
                    createdAt: { [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date() }
                },
                ...getPostBaseQuery(req)
            });
            res.send(postsByBlog);
        }

    }

    if (!success) {
        res.send({success: false});
    }
});

// TODO search users
app.post('/search', async (req, res) => {
    let success = false;
    let users: any = [];
    let posts: any = [];
    let promises: Promise<any>[] = [];
    if (req.body && req.body.term) {
        let searchTerm = req.body.term.toLowerCase().trim();
        //we get the tag if exists then get posts from the tag, same way ass dashboard
        let tagSearch = await Tag.findOne({
            where: {
                tagName: searchTerm
            }
        });
        if (tagSearch) {
            posts = tagSearch.getPosts({
                where: {
                    //date the user has started scrolling
                    createdAt: { [Op.lt]: req.body?.startScroll ? req.body.startScroll : new Date() }
                },
                ...getPostBaseQuery(req)

            });
            promises.push(posts);
        }
        users = User.findAll({
            limit: 20,
            offset: req.body?.page ? req.body.page * 20 : 0,
            where: {
                [Op.or]: [
                    sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', '%' + searchTerm + '%'),
                    sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), 'LIKE', '%' + searchTerm + '%')
                ]
            },
            attributes: {
                exclude: ['password', 'birthDate']
            }

        });
        promises.push(users)
    }
    await Promise.all(promises)
    res.send({
        users: await users, posts: await posts
    })
});


app.post('/register', async (req, res) => {
    // TODO: check captcha
    let success = false;
    if (req.body && req.body.email && req.files && req.files.length > 0 && validateEmail(req.body.email)) {
        let emailExists = await User.findOne({
            where: {
                [Op.or]: [

                    { email: req.body.email },

                    sequelize.where(sequelize.fn('LOWER', sequelize.col('url')), 'LIKE', '%' + req.body.url.toLowerCase().trim() + '%')

                ]
            }
        });
        if (!emailExists) {
            let files: any = req.files;
            const activationCode = generateRandomString();
            let user = {
                email: req.body.email,
                description: req.body.description.trim(),
                url: req.body.url,
                NSFW: req.body.nsfw === "true",
                password: await bcrypt.hash(req.body.password, environment.saltRounds),
                birthDate: new Date(req.body.birthDate),
                avatar: files[0].path,
                activated: false,
                registerIp: getPetitionIp(req),
                lastLoginIp: 'ACCOUNT_NOT_ACTIVATED',
                activationCode: activationCode


            };
            let userWithEmail = User.create(user);
            let emailSent = sendActivationEmail(req.body.email, activationCode,
                'Welcome to wafrn!',
                '<h1>Welcome to wafrn</h1> To activate your account <a href="' + activationCode + '">click here!</a>');
            await Promise.all([userWithEmail, emailSent]);
            success = true;
            res.send({
                success: true,
            });

        }

    }
    if (!success) {
        res.statusCode = 401;
        res.send({ success: false })
    }
});

app.post('/forgotPassword', async (req, res) => {
    let resetCode = generateRandomString();
    if (req.body && req.body.email && validateEmail(req.body.email) && validateEmail(req.body.email)) {
        let user = await User.findOne({
            where: {
                email: req.body.email
            }
        });
        if (user) {

            user.activationCode = resetCode;
            user.requestedPasswordReset = new Date();
            user.save();
            let email = await sendActivationEmail(req.body.email, '',
                'So you forgot your wafrn password',
                '<h1>Use this link to reset your password</h1> Click <a href="' + 'LINK WITH CODE' + '">here</a> to reset your password'
            );
        }

    }

    res.send({ status: true })

});

app.post('/activateUser', async (req, res) => {
    let success = false;
    if (req.body && req.body.email && validateEmail(req.body.email) && validateEmail(req.body.email) && req.body.code) {
        let user = await User.findOne({
            where: {
                email: req.body.email,
                activationCode: req.body.code
            }
        });
        if (user) {
            user.activated = true;
            user.save();
            success = true;
        }
    }

    res.send({
        success: success
    })

});

app.post('/resetPassword', async (req, res) => {
    let success = false;
    if (req.body && req.body.email && validateEmail(req.body.email) && validateEmail(req.body.email) && req.body.code && req.body.password) {
        const resetPasswordDeadline = new Date();
        resetPasswordDeadline.setTime(resetPasswordDeadline.getTime() + 3600 * 2 * 1000);
        let user = await User.findOne({
            where: {
                email: req.body.email,
                activationCode: req.body.code,
                requestedPasswordReset: { [Op.lt]: resetPasswordDeadline }

            }
        });
        if (user) {
            user.password = await bcrypt.hash(req.body.password, environment.saltRounds);
            user.requestedPasswordReset = null;
            user.save();
            success = true;
        }
    }

    res.send({
        success: success
    })

});

app.post('/login', async (req, res) => {
    // TODO: check captcha
    let success = false;
    if (req.body && req.body.email && req.body.password) {
        let userWithEmail = await User.findOne({ where: { email: req.body.email } });
        if (userWithEmail) {
            let correctPassword = await bcrypt.compare(req.body.password, userWithEmail.password);
            if (correctPassword) {
                success = true;
                if (userWithEmail.activated) {
                    res.send({
                        success: true,
                        token: jwt.sign({ userId: userWithEmail.id, email: userWithEmail.email, birthDate: userWithEmail.birthDate }, environment.jwtSecret, { expiresIn: '31536000s' })
                    });
                    userWithEmail.lastLoginIp = getPetitionIp(req);
                    userWithEmail.save();
                } else {
                    res.send({
                        success: false,
                        errorMessage: 'Please activate your account! Check your email'
                    })
                }
            }
        }


    }

    if (!success) {
        //res.statusCode = 401;
        res.send({ success: false, errorMessage: 'Please recheck your email and password' })
    }

});


app.post('/uploadPictures', authenticateToken, async (req: any, res) => {
    // TODO check captcha
    let files: any = req.files;
    let picturesPromise: Array<any> = [];
    if (files && files.length > 0) {
        files.forEach((file: any) => {
            picturesPromise.push(Media.create({
                url: file.path,
                NSFW: req.body.nsfw === 'true',
                userId: req.jwtData.userId
            }))
        });
    }
    let success = await Promise.all(picturesPromise)
    res.send(success);
});

app.post('/createPost', authenticateToken, async (req: any, res) => {
    // TODO check captcha
    let success = false;
    const posterId = req.jwtData.userId;

    if (req.body && req.body.content) {
        let post = await Post.create({
            content: req.body.content,
            NSFW: req.body.nsfw === 'true',
            userId: posterId
        });

        // detect media in post

        const regex = /\[wafrnmediaid="[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}"\]/gm;
        const uuidRegex = /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/
        let mediaInPost = req.body.content.match(regex);
        if (mediaInPost) {
            const mediaToAdd: String[] = [];
            mediaInPost.forEach((element: string) => {
                let mediaUUIDs = element.match(uuidRegex);
                if (mediaUUIDs) {
                    const uuid = mediaUUIDs[0];
                    if(mediaToAdd.indexOf(uuid) == -1) {
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
            let tagListString = req.body.tags.toLowerCase();
            let tagList = tagListString.split(',');
            tagList = tagList.map((s: string) => s.trim());
            let existingTags = await Tag.findAll({
                where: {
                    tagName: {
                        [Op.in]: tagList
                    }
                }
            });

            const newTagPromises: Array<Promise<any>> = [];
            if (existingTags) {
                existingTags.forEach((existingTag: any) => {
                    existingTag.addPost(post);
                    tagList.splice(tagList.indexOf(existingTag.tagName), 1)
                });
            }

            tagList.forEach((newTag: string) => {
                newTagPromises.push(Tag.create({
                    tagName: newTag
                }));
            });

            let newTags = await Promise.all(newTagPromises);
            newTags.forEach((newTag) => {
                newTag.addPost(post)
            })
            success = true;
        }
        res.send(post);
    }
    if (!success) {
        res.statusCode = 400;
        res.send({ success: false });
    }

});

app.get('/myRecentMedia', authenticateToken, async (req: any, res) => {
    let recentMedia = await Media.findAll({
        where: {
            userId: req.jwtData.userId,
        },
        limit: 5,
        order: [['createdAt', 'DESC']]

    });
    res.send(recentMedia)
});

app.post('/reportPost', authenticateToken, async (req: any, res) => {
    // we have to process the content of the post to find wafrnmedia
    // and check that the user is only posting its own media. or should we?
    let success = false;
    let report;
    const posterId = req.jwtData.userId;
    if (req.body && req.body.postId && req.body.severity && req.body.description) {
        report = await PostReport.create({
            resolved: false,
            severity: req.body.severity,
            description: req.body.description,
            userId: posterId,
            postId: req.body.postId
        });
        success = true;
        res.send(report);
    }
    if (!success) {
        res.send({
            success: false
        })
    }


});


app.post('/reportUser', authenticateToken, async (req: any, res) => {
    // we have to process the content of the post to find wafrnmedia
    // and check that the user is only posting its own media. or should we?
    let success = false;
    let report;
    const posterId = req.jwtData.userId;
    if (req.body && req.body.userId && req.body.severity && req.body.description) {
        report = await PostReport.create({
            resolved: false,
            severity: req.body.severity,
            description: req.body.description,
            reporterId: posterId,
            reportedId: req.body.userId
        });
        success = true;
        res.send(report);
    }
    if (!success) {
        res.send({
            success: false
        })
    }


});

app.post('/follow', authenticateToken, async (req: any, res) => {
    // we have to process the content of the post to find wafrnmedia
    // and check that the user is only posting its own media. or should we?
    let success = false;
    const posterId = req.jwtData.userId;
    if (req.body && req.body.userId) {
        let userFollowed = await User.findOne({
            where: {
                id: req.body.userId
            }
        });

        userFollowed.addFollower(posterId);
        success = true;
    }

    res.send({
        success: success
    });


});

app.post('/unfollow', authenticateToken, async (req: any, res) => {
    // we have to process the content of the post to find wafrnmedia
    // and check that the user is only posting its own media. or should we?
    let success = false;
    const posterId = req.jwtData.userId;
    if (req.body && req.body.userId) {
        let userUnfollowed = await User.findOne({
            where: {
                id: req.body.userId
            }
        });

        userUnfollowed.removeFollower(posterId);
        success = true;
    }

    res.send({
        success: success
    });


});

app.post('/block', authenticateToken, async (req: any, res) => {
    // we have to process the content of the post to find wafrnmedia
    // and check that the user is only posting its own media. or should we?
    let success = false;
    const posterId = req.jwtData.userId;
    if (req.body && req.body.userId) {
        let userBlocked = await User.findOne({
            where: {
                id: req.body.userId
            }
        });

        userBlocked.addBlocker(posterId);
        userBlocked.removeFollowed(posterId);
        success = true;
    }

    res.send({
        success: success
    });


});


app.post('/unblock', authenticateToken, async (req: any, res) => {
    // we have to process the content of the post to find wafrnmedia
    // and check that the user is only posting its own media. or should we?
    let success = false;
    const posterId = req.jwtData.userId;
    if (req.body && req.body.userId) {
        let userUnblocked = await User.findOne({
            where: {
                id: req.body.userId
            }
        });

        userUnblocked.removeBlocker(posterId);
        success = true;
    }

    res.send({
        success: success
    });


});


app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});
