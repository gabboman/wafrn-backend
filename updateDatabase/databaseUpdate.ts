/* eslint-disable require-jsdoc */
'use strict';
const environment = require('../environment');

const {Sequelize} = require('sequelize');// sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize);

const sequelize = new Sequelize(
    environment.databaseConnectionString,
    {
      logging: !environment.prod,
    },
);

const queryInterface = sequelize.getQueryInterface();
// primera migración: añadir limite por extras
queryInterface.addColumn(
    'users',
    'ipUpload', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'PREVIOUS_TO_UPLOAD_IP_LOGGING',
    },
);

/*
queryInterface.createTable('postViews', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
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