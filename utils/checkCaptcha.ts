const request = require('request-promise');

export interface HCaptchaSiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export default async function checkCaptcha(response: string, ip: string) {
  let res = false;
  const secretKey = environment.captchaPrivateKey;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${response}&remoteip=${ip}`;
  const googleResponse = await request(url);
  res = JSON.parse(googleResponse).success;
  return res as boolean;
}
