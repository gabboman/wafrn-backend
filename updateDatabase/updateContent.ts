import { User } from '../models'
import { generateKeyPair, generateKeyPairSync } from 'crypto'

async function createKeysForUsers () {
  const users = await User.findAll()
  for await (const user of users) {
    const {publicKey, privateKey} = generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })
    user.privateKey = privateKey
    user.publicKey = publicKey
    await user.save()
  }
}

createKeysForUsers().then(() => console.log('finished'))
