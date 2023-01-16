const environment = require('../environment')

const { Sequelize } = require('sequelize') // sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize)

const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging: !environment.prod
})

const queryInterface = sequelize.getQueryInterface()

// Add new table

queryInterface.createTable('federatedHosts', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true
  },
  displayName: Sequelize.TEXT,
  publicInbox: Sequelize.TEXT,
  publicKey: Sequelize.TEXT,
  detail: Sequelize.STRING,
  blocked: Sequelize.BOOLEAN,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE
})
// add column

queryInterface.addColumn(
  'posts',
  'privacy', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
    unique: false
  }
)

queryInterface.addColumn(
  'posts',
  'remotePostId', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: true
  }
)

queryInterface.addColumn(
  'follows',
  'remoteFollowId', {
    type: Sequelize.TEXT,
    allowNull: true
  }
)

queryInterface.addColumn(
  'medias',
  'external', {
    defaultValue: false,
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
)

queryInterface.addColumn(
  'users',
  'hostId', {
    type: Sequelize.UUID,
    allowNull: true,
    references: {
      model: 'federatedHosts',
      key: 'id'
    },
    unique: false
  }
)

queryInterface.addColumn(
  'users',
  'publicKey', {
    type: Sequelize.TEXT,
    allowNull: false,
    unique: false
  }
)

queryInterface.addColumn(
  'users',
  'privateKey', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: false
  }
)
queryInterface.addColumn(
  'users',
  'remoteInbox', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: false
  }
)

queryInterface.addColumn(
  'users',
  'remoteId', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: false
  }
)

/*
queryInterface.removeColumn(
  'posts',
  'NSFW'
);
*/
