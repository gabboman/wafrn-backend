import { environment } from './environment'
import { logger } from './utils/logger'

const { Sequelize } = require('sequelize')
require('sequelize-hierarchy-fork')(Sequelize)

const db = new Sequelize(environment.databaseConnectionString, {
  logging: environment.logSQLQueries ? logger.debug : false
})

export default db
