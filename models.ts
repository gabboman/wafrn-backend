import sequelize from './db'
const { Sequelize } = require('sequelize')

const User = sequelize.define('users', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  email: {
    type: Sequelize.STRING,
    allowNull: true,
    //unique: true
  },
  description: Sequelize.TEXT,
  url: {
    type: Sequelize.STRING,
    unique: true
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
    defaultValue: new Date().setTime(0)
  },
  privateKey: Sequelize.TEXT,
  publicKey: Sequelize.TEXT,
  federatedHostId: {
    type: Sequelize.UUID,
    allowNull: true,
    primaryKey: true
  },
  remoteInbox: Sequelize.TEXT,
  remoteId: Sequelize.TEXT
})

const Follows = sequelize.define('follows', {
  followedId: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  followerId: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  remoteFollowId: Sequelize.TEXT

})

const Post = sequelize.define('posts', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  content_warning: Sequelize.STRING,
  content: Sequelize.TEXT,
  remotePostId: Sequelize.TEXT,
  privacy: Sequelize.INTEGER
})

const Tag = sequelize.define('tags', {
  tagName: Sequelize.TEXT
})

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
  ipUpload: Sequelize.STRING,
  adultContent: Sequelize.BOOLEAN,
  external: {
    defaultValue: false,
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
})

const PostReport = sequelize.define('postReports', {
  resolved: Sequelize.BOOLEAN,
  severity: Sequelize.INTEGER,
  description: Sequelize.TEXT
})

const UserReport = sequelize.define('userReports', {
  resolved: Sequelize.BOOLEAN,
  severity: Sequelize.INTEGER,
  description: Sequelize.TEXT
})

const PostMentionsUserRelation = sequelize.define('postMentionsUserRelations', {
  userId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    },
    unique: false
  },
  postId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'posts',
      key: 'id'
    },
    unique: false
  }
})

const UserLikesPostRelations = sequelize.define('userLikesPostRelations', {
  userId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    },
    unique: false
  },
  postId: {
    type: Sequelize.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'posts',
      key: 'id'
    },
    unique: false
  },
  remoteId: {
    type: Sequelize.STRING,
    allowNull: true
  }
})

const FederatedHost = sequelize.define('federatedHosts', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  displayName: Sequelize.STRING,
  publicInbox: Sequelize.TEXT,
  publicKey: Sequelize.TEXT,
  detail: Sequelize.STRING,
  blocked: Sequelize.BOOLEAN
})

User.belongsToMany(User, {
  through: 'follows',
  as: 'followed',
  foreignKey: 'followedId'
})

User.belongsToMany(User, {
  through: 'follows',
  as: 'follower',
  foreignKey: 'followerId'
})

User.belongsToMany(User, {
  through: 'blocks',
  as: 'blocker',
  foreignKey: 'blockerId'
})

User.belongsToMany(User, {
  through: 'blocks',
  as: 'blocked',
  foreignKey: 'blockedId'
})

PostReport.belongsTo(User)
PostReport.belongsTo(Post)

UserReport.belongsTo(User, { foreignKey: 'ReporterId' })
UserReport.belongsTo(User, { foreignKey: 'ReportedId' })

User.belongsTo(FederatedHost, { foreignKey: 'federatedHostId' })
FederatedHost.hasMany(User)
User.hasMany(Post)
Post.belongsTo(User)
Post.isHierarchy()
Media.belongsTo(User)
Tag.belongsToMany(Post, {
  through: 'tagPostRelations'
})
Post.belongsToMany(Tag, {
  through: 'tagPostRelations'
})
Media.belongsToMany(Post, {
  through: 'postMediaRelations'
})
Post.belongsToMany(Media, {
  through: 'postMediaRelations'
})

// mentions
PostMentionsUserRelation.belongsTo(User)
PostMentionsUserRelation.belongsTo(Post)
User.hasMany(PostMentionsUserRelation)
Post.hasMany(PostMentionsUserRelation)

UserLikesPostRelations.belongsTo(User)
UserLikesPostRelations.belongsTo(Post)
User.hasMany(UserLikesPostRelations)
Post.hasMany(UserLikesPostRelations)

export {
  User,
  Post,
  PostReport,
  UserReport,
  Tag,
  Follows,
  Media,
  PostMentionsUserRelation,
  UserLikesPostRelations,
  FederatedHost
}
