import { Op } from 'sequelize'
import { User } from '../../db'
import { wait } from '../wait'
import sendActivationEmail from '../sendActivationEmail'

async function sendMail() {
  const users = await User.findAll({
    attributes: ['url', 'email'],
    where: {
      banned: { [Op.ne]: true },
      activated: true,
      url: {
        [Op.notLike]: '%@%'
      }
    },
    order: [['createdAt', 'ASC']]
  })

  for await (const user of users) {
    const subject = `Hello ${user.url}, we made a huge update with the notifications page!`
    const body = `
    <h1>What's up ${user.url}, hope all is ok!😀</h1>
    <p>We have done a huge update to <a href="https://app.wafrn.net" target="_blank">wafrn's notification page</a>, you should check it!</p>
    <p>The new notifications page has been improved by a lot, come, take a look, you have at least 69 notifications. Science says so.</p>
    <p>Also, feel free to reply to this email if you have any questions, messages, or you just want to say "lol i dont even remember joining this hellsite lol"</p>
    `
    console.log(`mailing ${user.url}`)
    await sendActivationEmail(user.email, '', subject, body)
    await wait(5000)
  }
}

sendMail()
