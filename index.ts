'use strict';


import express from 'express';
const Sequelize = require('sequelize');
const environment = require('./environment');
import { BodyParser } from 'body-parser';

import multer from 'multer';
const imageStorage = multer.diskStorage({
    // Destination to store image     
    destination: 'uploads',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '_' + Date.now() + '_' +
            file.originalname.replace(' ', '_'))

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
})

// rest of the code remains same
const app = express();
const PORT = 8000;

const sequelize = new Sequelize(environment.databaseConnectionString);

const User = sequelize.define('users', {
    username: Sequelize.STRING,
    description: Sequelize.TEXT,
    url: Sequelize.STRING,
    NSFW: Sequelize.BOOLEAN,
    avatar: Sequelize.STRING,
    registrationDate: Sequelize.DATE,
    password: Sequelize.STRING,
    birthDate: Sequelize.DATE
});

const Post = sequelize.define('posts', {
    NSFW: Sequelize.BOOLEAN,
    creationDate: Sequelize.DATE,
    content: Sequelize.TEXT
});

const Image = sequelize.define('images', {
    NSFW: Sequelize.BOOLEAN,
    creationDate: Sequelize.DATE,
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

User.hasMany(Post);
Post.belongsTo(User);
Post.belongsTo(Post);
Image.belongsTo(User);
Post.hasMany(Image);
/*
Post.hasMany(PostDennounce);
PostDennounce.belongsTo(User);
UserDennounce.belongsTo(User);
User.hasMany(UserDennounce);
*/








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







app.get('/', (req, res) => res.send('Express + TypeScript Server'));
app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});