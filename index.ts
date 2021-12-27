'use strict';


import express from 'express';
const Sequelize = require('sequelize');
const environment = require('./environment');
var crypto = require('crypto')
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
    username: Sequelize.STRING,
    description: Sequelize.TEXT,
    url: Sequelize.STRING,
    NSFW: Sequelize.BOOLEAN,
    avatar: Sequelize.STRING,
    password: Sequelize.STRING,
    birthDate: Sequelize.DATE
});

const Post = sequelize.define('posts', {
    NSFW: Sequelize.BOOLEAN,
    content: Sequelize.TEXT
});

const Image = sequelize.define('images', {
    NSFW: Sequelize.BOOLEAN,
    url: Sequelize.TEXT,
});

/*
//TODO still unsure on how to do this
const PostDennounce = sequelize.define('PostDennounces', {
    resolved: Sequelize.BOOLEAN,
    creationDate: Sequelize.DATE,
    severity: Sequelize.INTEGER
});

const UserDennounce = sequelize.define('UserDennounces', {
    resolved: Sequelize.BOOLEAN,
    creationDate: Sequelize.DATE,
    severity: Sequelize.INTEGER
});

*/


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

User.hasMany(Post);
Post.belongsTo(User);
Post.belongsTo(Post);
Image.belongsTo(User);
Post.hasMany(Image);








sequelize.sync({
    force: environment.forceSync,
    logging: environment.prod
})
    .then(async () => {
        console.log(`Database & tables created!`);
        if (environment.forceSync) {
            console.log('CLEANING DATA');
            // seeder();

        }
    });



app.get('/', (req, res) => res.send('Welcome to WAFRN API.'));

// serve static images
app.use('/uploads', express.static('uploads'));


app.post('/register', async (req, res) => {
    // TODO: check captcha


});

app.post('/login', async (req, res) => {
    // TODO: check captcha

});


app.post('/uploadPictures', async (req, res) => {
    let files: any = req.files;
    let picturesPromise: Array<any> = [];
    if (files && files.length > 0) {
        files.forEach((file: any) => {
            picturesPromise.push(Image.create({
                url: file.path,
                NSFW: req.body.nsfw === 'true'
            }))
        });
    }
    let success = await Promise.all(picturesPromise)
    res.send(success);
});


app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});