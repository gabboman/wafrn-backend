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
  blocked: Sequelize.BOOLEAN
});


// add column
queryInterface.addColumn(
  'medias',
  'external', {
    defaultValue: false,
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
);

queryInterface.addColumn(
  'users',
  'hostId', {
    type: Sequelize.UUID,
    allowNull: true,
    references: {
      model: 'federatedHosts',
      key: 'id',
    },
    unique: false,
  }
);

/*
queryInterface.removeColumn(
  'posts',
  'NSFW'
);
*/

