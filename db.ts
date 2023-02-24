import { environment } from './environment'

const { Sequelize } = require('sequelize')
require('sequelize-hierarchy-fork')(Sequelize)

const db = new Sequelize(environment.databaseConnectionString, {
  logging: environment.logSQLQueries ? console.log : false
})

export default db
