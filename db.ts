import { environment } from './environment'
import { logger } from './utils/logger'
const { Sequelize } = require('sequelize')
import { Table, Column, Model, HasMany } from 'sequelize-typescript'
require('sequelize-hierarchy-fork')(Sequelize)

const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging: environment.logSQLQueries ? (sql: any) => logger.trace(sql) : false,
  pool: {
    max: 20,
    min: 1,
    acquire: 30000,
    idle: 100000
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
}, {
  indexes: [{
    unique: true,
    fields: ['displayName']
  }
  ]
}
)

const User = sequelize.define('users', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  email: {
    type: Sequelize.STRING,
    allowNull: true
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
    primaryKey: false
  },
  remoteInbox: Sequelize.TEXT,
  remoteId: Sequelize.TEXT,
  banned: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  }
}, {
  indexes: [{
    unique: true,
    fields: ['remoteId']
  }
  ]
})

const Follows = sequelize.define('follows', {
  remoteFollowId: Sequelize.TEXT
}, {
  indexes: [{
    unique: false,
    fields: ['followedId', 'followerId']
  }
  ]
})

const Blocks = sequelize.define('blocks', {
  remoteBlockId: Sequelize.TEXT
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
},{
  indexes: [{
    unique: true,
    fields: ['remotePostId']
  }
  ]
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


User.belongsToMany(User, {
  through: Follows,
  as: 'followed',
  foreignKey: 'followerId'
})

User.belongsToMany(User, {
  through: Follows,
  as: 'follower',
  foreignKey: 'followedId'
})

Follows.belongsTo(User, {
  as: 'follower',
  foreignKey: 'followedId'
})

Follows.belongsTo(User, {
  as: 'followed',
  foreignKey: 'followerId'
})

User.belongsToMany(User, {
  through: Blocks,
  as: 'blocker',
  foreignKey: 'blockerId'
})

User.belongsToMany(User, {
  through: Blocks,
  as: 'blocked',
  foreignKey: 'blockerId'
})

Blocks.belongsTo(User, {
  as: 'blocker',
  foreignKey: 'blockedId'
})

Blocks.belongsTo(User, {
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

sequelize
  .sync({
    force: environment.forceSync
  })
  .then(async () => {
    logger.info('Database & tables ready!')
    logger.debug('debug enabled')
    logger.trace('trace enabled')
    if (environment.forceSync) {
      logger.info('CLEANING DATA')
      // seeder();
    }
  })

export {
  sequelize,
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
