'use strict';


import express from 'express';
const Sequelize = require('sequelize');
const environment = require('./environment');
var crypto = require('crypto');
const bcrypt = require("bcrypt");
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
    email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
    },
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

//TODO still unsure on how to do this
const PostDennounce = sequelize.define('postDennounces', {
    resolved: Sequelize.BOOLEAN,
    severity: Sequelize.INTEGER
});

const UserDennounce = sequelize.define('userDennounces', {
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

PostDennounce.belongsTo(User);
PostDennounce.belongsTo(Post);

UserDennounce.belongsTo(User, {foreignKey: 'dennouncerId'})
UserDennounce.belongsTo(User, {foreignKey: 'dennouncedId'})

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


function validateEmail(email: string) {
    const res = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return res.test(String(email).toLowerCase());
  }

app.post('/register', async (req, res) => {
    // TODO: check captcha
    let success = false;
    if(req.body.email && req.files &&  req.files.length >0 && validateEmail(req.body.email)) {
        // TODO: fix this function, get avatar and set it properly. Check fields are NOT empty
        let files:any = req.files;
        let user = {
            email: req.body.email,
            description: req.body.description,
            url: req.body.url,
            NSFW: req.body.nsfw === "true",
            password: await bcrypt.hash(req.body.password),
            birthDate: new Date(req.body.birthDate),
            //avatar: files[0].path
    
        }
        success = await User.create(user);
    }



    res.send(success);


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