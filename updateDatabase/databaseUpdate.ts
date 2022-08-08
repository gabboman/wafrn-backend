/* eslint-disable require-jsdoc */
const environment = require('../environment');

const {Sequelize} = require('sequelize'); // sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize);

const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging: !environment.prod,
});

const queryInterface = sequelize.getQueryInterface();
// add column
/*
queryInterface.addColumn(
    'users',
    'lastTimeNotificationsCheck', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: '1970-01-01 00:00:00',
    },
);
*/

// Add new table
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
