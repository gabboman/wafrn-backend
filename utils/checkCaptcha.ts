import axios from 'axios'
const environment = require('../environment')

export interface HCaptchaSiteVerifyResponse {
  success: boolean
  'error-codes'?: string[]
}

export default async function checkCaptcha (response: string, ip: string) {
  let res = false
  const secretKey = environment.captchaPrivateKey
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${response}&remoteip=${ip}`
  const googleResponse = await axios.get(url)
  res = googleResponse.data.success
  return res
}
