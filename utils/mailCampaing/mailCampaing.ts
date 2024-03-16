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
    const subject = `Hello ${user.url}, BE WARE OF THE IDES OF MARCH!`
    const body = `
    <h1>What's up ${user.url}, hope all is ok!😀</h1>
    <p>We have done some small updates to <a href="https://app.wafrn.net" target="_blank">wafrn</a> lately, you should check us again!</p>
    <p>The updates do not include protection against knifes in the senate tho<p>
    <img src="https://media.wafrn.net/1710404859891_554f3e53391f297ce47be10cc13a177eb971542b.webp">
    <p>Also, feel free to reply to this email if you have any questions, messages, or you just want to say "lol i dont even remember joining there lool"</p>
    `
    console.log(`mailing ${user.url}`)
    await sendActivationEmail(user.email, '', subject, body)
    await wait(5000)
  }
}

sendMail()
