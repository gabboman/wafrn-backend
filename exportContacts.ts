import { User } from './models'

User.findAll({
  where: {
    activated: 1
  }
}).then((users: any) => {
  console.log('EMAIL,FIRSTNAME')
  users.forEach((singleUser: any) => {
    const csvLine =
      singleUser.email + ',' + singleUser.url.replace(',', '') /* + ',' +
            singleUser.createdAt + ',1' */
    console.log(csvLine)
  })
})
