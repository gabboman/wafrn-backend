/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
'use strict';

import { userInfo } from "os";

const environment = require('./environment');

const {
  Sequelize,
} = require('sequelize');
require('sequelize-hierarchy-fork')(Sequelize);


const sequelize = new Sequelize(environment.databaseConnectionString,
    {
      logging: environment.logSQLQueries ? console.log : false,
    });

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
  postId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'posts',
      key: 'id',
    },
    unique: false,
  },
});

const PostMentionsUserRelation = sequelize.define('postMentionsUserRelations', {
  userId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id',
    },
    unique: false,
  },
  postId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
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

// mentions
PostMentionsUserRelation.belongsTo(User);
PostMentionsUserRelation.belongsTo(Post);
User.hasMany(PostMentionsUserRelation);
Post.hasMany(PostMentionsUserRelation);

export {
  User, Post, PostReport, PostView, UserReport, Tag, Media, PostMentionsUserRelation,
};
