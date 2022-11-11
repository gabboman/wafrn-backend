const environment = require('../environment')

const { Sequelize } = require('sequelize') // sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize)

const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging: !environment.prod
})

const queryInterface = sequelize.getQueryInterface()
// add column

queryInterface.addColumn(
  'medias',
  'adultContent', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
)

// Add new table
/*
queryInterface.createTable('postMentionsUserRelations', {
  userId: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    unique: false,
  },
  postId: {
    type: Sequelize.UUID,
    allowNull: false,
    references: {
      model: 'posts',
      key: 'id',
    },
    unique: false,
  },
  createdAt: {
    type: Sequelize.DATE,
  },
  updatedAt: {
    type: Sequelize.DATE,
  },
});
*/
