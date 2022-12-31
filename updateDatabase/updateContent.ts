import { User } from '../models'
import * as ed from '@noble/ed25519'

async function createKeysForUsers () {
  const users = await User.findAll()
  for await (const user of users) {
    const privateKey = await ed.utils.randomPrivateKey()
    const privateKeyString = Buffer.from(privateKey).toString('hex')
    const publicKey = Buffer.from(await ed.getPublicKey(privateKey)).toString('hex')
    user.privateKey = privateKeyString
    user.publicKey = publicKey
    await user.save()
  }
}

createKeysForUsers().then(() => console.log('finished'))
