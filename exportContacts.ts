import { User } from './db'
import { logger } from './utils/logger'

User.findAll({
  where: {
    activated: 1
  }
}).then((users: any) => {
  logger.info('EMAIL,FIRSTNAME')
  users.forEach((singleUser: any) => {
    const csvLine =
      singleUser.email + ',' + singleUser.url.replace(',', '') /* + ',' +
            singleUser.createdAt + ',1' */
    logger.info(csvLine)
  })
})
