import { environment } from './environment'
import { logger } from './utils/logger'
const { Sequelize } = require('sequelize')
import { Table, Column, Model, HasMany } from 'sequelize-typescript'

require('sequelize-hierarchy-fork')(Sequelize)

const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging: (sql: any, time: number) => {
    if (environment.logSQLQueries) {
      logger.trace({ duration: time, query: sql })
    } else if (time > 2500) {
      logger.warn({ duration: time, query: sql })
    }
  },
  pool: {
    max: 10,
    min: 1,
    acquire: 30000,
    idle: 100000
  },
  retry: {
    max: environment.prod ? 5 : 0,
    backoffBase: 3000, // Initial backoff duration in ms. Default: 100,
    backoffExponent: 1.5 // Exponent to increase backoff each try. Default: 1.1
  },
  benchmark: true
})

const FederatedHost = sequelize.define(
  'federatedHosts',
  {
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
    blocked: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    }
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['displayName']
      }
    ]
  }
)

const User = sequelize.define(
  'users',
  {
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
      defaultValue: new Date()
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
    },
    role: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    }
  },
  {
    indexes: [
      {
        unique: true,
        fields: [{
          attribute: 'remoteId',
          length: 512
        }],
      },
      {
        unique: false,
        fields: [{
          attribute: 'remoteInbox',
          length: 512
        }]
      },
      {
        unique: true,
        fields: [{
          attribute: 'url',
          length: 128
        }]
      },
      {
        unique: true,
        fields: [{
          attribute: 'email',
          length: 128
        }]
      }
    ]
  }
)

const Follows = sequelize.define(
  'follows',
  {
    remoteFollowId: Sequelize.TEXT
  },
  {
    indexes: [
      {
        unique: false,
        fields: ['followerId']
      },
      {
        unique: false,
        fields: ['followedId']
      },
      {
        unique: true,
        fields: ['followedId', 'followerId']
      }
    ]
  }
)

const Blocks = sequelize.define('blocks', {
  remoteBlockId: Sequelize.TEXT,
  reason: Sequelize.TEXT
},
{
  indexes: [
    {
      unique: false,
      fields: ['blockerId']
    },
    {
      unique: false,
      fields: ['blockedId']
    },
    {
      unique: true,
      fields: ['blockedId', 'blockerId']
    }
  ]
}
)

const Mutes = sequelize.define('mutes', {
  reason: Sequelize.TEXT
})

const ServerBlock = sequelize.define('serverBlocks', {})

const Post = sequelize.define(
  'posts',
  {
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
  },
  {
    indexes: [
      {
        //unique: true,
        fields: [{
          attribute: 'remotePostId',
          length: 512
        }]
      },
      {
        unique: false,
        fields: ['parentId']
      },
      {
        unique: false,
        fields: ['userId']
      }
    ]
  }
)

const Tag = sequelize.define(
  'tags',
  {
    tagName: Sequelize.TEXT
  },
  {
    indexes: [
      {
        // unique: true,
        fields: [{
          attribute: 'tagName',
          length: 512
        }]
      }
    ]
  }
)

const Emoji = sequelize.define('emojis', {
  id: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true
  },
  name: Sequelize.STRING,
  url: Sequelize.TEXT,
  external: Sequelize.BOOLEAN
})

const EmojiCollection = sequelize.define('emojiCollections', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  name: Sequelize.STRING
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

const PostMentionsUserRelation = sequelize.define('postMentionsUserRelations', {},
{
  indexes: [
    {
      // unique: true,
      fields: [{
        attribute: 'postId',
        //length: 1024
      }]
    }
  ]
}
)

PostMentionsUserRelation.removeAttribute('id')

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
},
{
  indexes: [
    {
      fields: [{
        attribute: 'postId',
      }]
    }
  ]
}
)

User.belongsToMany(User, {
  through: Follows,
  as: 'followed',
  foreignKey: 'followerId'
})

Post.belongsToMany(Emoji, {
  through: 'postEmojiRelations'
})
Emoji.belongsToMany(Post, {
  through: 'postEmojiRelations'
})
Emoji.belongsTo(EmojiCollection)
EmojiCollection.hasMany(Emoji)

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
  foreignKey: 'blockedId'
})

User.belongsToMany(User, {
  through: Blocks,
  as: 'blocked',
  foreignKey: 'blockerId'
})

Blocks.belongsTo(User, {
  as: 'blocker',
  foreignKey: 'blockerId'
})

Blocks.belongsTo(User, {
  as: 'blocked',
  foreignKey: 'blockedId'
})

User.belongsToMany(User, {
  through: Mutes,
  as: 'muter',
  foreignKey: 'mutedId'
})

User.belongsToMany(User, {
  through: Mutes,
  as: 'muted',
  foreignKey: 'muterId'
})

Mutes.belongsTo(User, {
  as: 'muter',
  foreignKey: 'muterId'
})

Mutes.belongsTo(User, {
  as: 'muted',
  foreignKey: 'mutedId'
})

ServerBlock.belongsTo(User, {
  as: 'userBlocker'
})
ServerBlock.belongsTo(FederatedHost, {
  as: 'blockedServer'
})

PostReport.belongsTo(User)
PostReport.belongsTo(Post)
Post.hasMany(PostReport)
User.hasMany(PostReport)

UserReport.belongsTo(User, { foreignKey: 'ReporterId' })
UserReport.belongsTo(User, { foreignKey: 'ReportedId' })

User.belongsTo(FederatedHost, { foreignKey: 'federatedHostId' })
FederatedHost.hasMany(User)
User.hasMany(Post)
Post.belongsTo(User, {
  as: 'user'
})
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
User.belongsToMany(Post, {
  through: PostMentionsUserRelation,
  as: 'mentioner',
  foreignKey: 'userId'
})

Post.belongsToMany(User, {
  through: PostMentionsUserRelation,
  as: 'mentionPost',
  foreignKey: 'postId'
})

UserLikesPostRelations.belongsTo(User)
UserLikesPostRelations.belongsTo(Post)
User.hasMany(UserLikesPostRelations)
Post.hasMany(UserLikesPostRelations)

sequelize
  .sync({
    force: environment.forceSync
  })
  .then(async () => {
    if (environment.forceSync) {
      logger.info('CLEANING DATA')
      // seeder();
    }
  })

export {
  sequelize,
  User,
  Blocks,
  Mutes,
  Post,
  PostReport,
  UserReport,
  Tag,
  Follows,
  Media,
  Emoji,
  PostMentionsUserRelation,
  UserLikesPostRelations,
  FederatedHost,
  ServerBlock
}
