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
import { BodyParser } from 'body-parser';

import multer from 'multer';
const imageStorage = multer.diskStorage({
    // Destination to store image     
    destination: 'uploads',
    filename: (req, file, cb) => {
        let originalNameArray = file.originalname.split('.');
        let extension = originalNameArray[originalNameArray.length - 1];
        let randomText = crypto.createHash('sha1').update(Math.random().toString()).digest("hex")
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
    birthDate: Sequelize.DATE
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
    type: Sequelize.INTEGER,
    description: Sequelize.TEXT,
    url: Sequelize.TEXT,
});

const PostReport = sequelize.define('postReports', {
    resolved: Sequelize.BOOLEAN,
    severity: Sequelize.INTEGER
});

const UserReport = sequelize.define('userReports', {
    resolved: Sequelize.BOOLEAN,
    severity: Sequelize.INTEGER
});



User.belongsToMany(User, {
    through: 'followers',
    as: 'parents',
    foreignKey: 'followedId'
});

User.belongsToMany(User, {
    through: 'followers',
    as: 'children',
    foreignKey: 'followerId'
});

PostReport.belongsTo(User);
PostReport.belongsTo(Post);

UserReport.belongsTo(User, { foreignKey: 'ReportrId' })
UserReport.belongsTo(User, { foreignKey: 'ReportdId' })

User.hasMany(Post);
Post.belongsTo(User);
Post.isHierarchy();
Media.belongsTo(User);
Tag.belongsToMany(Post, {
    through: 'tagPostRelations',
});
Post.belongsToMany(Tag, {
    through: 'tagPostRelations',

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

app.get('/', (req, res) => res.send('Welcome to WAFRN API.'));

// serve static images
app.use('/uploads', express.static('uploads'));


function validateEmail(email: string) {
    const res = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return res.test(String(email).toLowerCase());
}

app.post('/register', async (req, res) => {
    // TODO: check captcha
    let success = false;
    if (req.body && req.body.email && req.files && req.files.length > 0 && validateEmail(req.body.email)) {
        let emailExists = await User.findOne({
            where: {
                [Op.or]: [

                    { email: req.body.email },

                    { url: req.body.url }

                ]
            }
        });
        if (!emailExists) {
            let files: any = req.files;
            let user = {
                email: req.body.email,
                description: req.body.description,
                url: req.body.url,
                NSFW: req.body.nsfw === "true",
                password: await bcrypt.hash(req.body.password, environment.saltRounds),
                birthDate: new Date(req.body.birthDate),
                avatar: files[0].path

            }
            let userWithEmail = await User.create(user);
            success = true;
            res.send({
                success: true,
                token: jwt.sign({ userId: userWithEmail.id, email: userWithEmail.email }, environment.jwtSecret, { expiresIn: '31536000s' })
            });

        }

    }
    if (!success) {
        res.statusCode = 401;
        res.send({ success: false })
    }
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
                res.send({
                    success: true,
                    token: jwt.sign({ userId: userWithEmail.id, email: userWithEmail.email }, environment.jwtSecret, { expiresIn: '31536000s' })
                });
            }
        }


    }

    if (!success) {
        res.statusCode = 401;
        res.send({ success: false })
    }

});


app.post('/uploadPictures', authenticateToken, async (req: any, res) => {
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
    // we have to process the content of the post to find wafrnmedia
    // and check that the user is only posting its own media. or should we?
    let success = false;
    const posterId = req.jwtData.userId;
    if (req.body && req.body.content) {
        let post = await Post.create({
            content: req.body.content,
            NSFW: req.body.nsfw === 'true',
            userId: posterId
        });

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


app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});
