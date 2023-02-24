import { environment } from '../environment'

const { Sequelize } = require('sequelize') // sequelize plugins
require('sequelize-hierarchy-fork')(Sequelize)

const sequelize = new Sequelize(environment.databaseConnectionString, {
  logging: !environment.prod
})

const queryInterface = sequelize.getQueryInterface()

async function dbUpdate() {
// Add new table

 await queryInterface.createTable('federatedHosts', {
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

 await queryInterface.addColumn(
  'posts',
  'privacy', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
    unique: false
  }
)

 await queryInterface.addColumn(
  'posts',
  'remotePostId', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: true
  }
)

 await queryInterface.addColumn(
  'follows',
  'remoteFollowId', {
    type: Sequelize.TEXT,
    allowNull: true
  }
)

 await queryInterface.addColumn(
  'medias',
  'external', {
    defaultValue: false,
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
)

 await queryInterface.addColumn(
  'users',
  'federatedHostId', {
    type: Sequelize.UUID,
    allowNull: true,
    references: {
      model: 'federatedHosts',
      key: 'id'
    },
    unique: false
  }
)

 await queryInterface.addColumn(
  'users',
  'publicKey', {
    type: Sequelize.TEXT,
    allowNull: false,
    unique: false
  }
)

 await queryInterface.addColumn(
  'users',
  'privateKey', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: false
  }
)
 await queryInterface.addColumn(
  'users',
  'remoteInbox', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: false
  }
)

 await queryInterface.addColumn(
  'users',
  'remoteId', {
    type: Sequelize.TEXT,
    allowNull: true,
    unique: false
  }
)

}


/*
 await queryInterface.removeColumn(
  'posts',
  'NSFW'
);
*/

dbUpdate().then(()=> {
  console.log('done')
}).catch(error => {
  console.log(error)
})