export const environment = {
    "prod": false,
    "logSQLQueries": false,
    "forceSync": false,
    "databaseConnectionString": "mariadb://user:password@127.0.0.1/wafrn",
    "port": 3000,
    "saltRounds": 12,
    "jwtSecret": "JWTSECRET",
    "captchaPrivateKey": "GOOGLE_CAPTCHA_PRIVATE_KEY", 
    "frontendUrl": "FEDIVERSE_URL_WITH_HTTPS",
    "instanceUrl": "FEDIVERSE_URL_NO_PROTOCOL",
    "mediaUrl": "MEDIA_URL_OR_API_URL",
    "fronendToProxyUrl": "FRONTEND_URL",
    "externalCacheurl": "FEDIVERSE_CACHINATOR",
    "removeFolderNameFromFileUploads": false,
    "adminUser": "ADMIN_USER_URL",
    "uploadSize": 50,
    logLevel: 'debug',
    pinoTransportOptions: {
        targets: [
          { target: 'pino/file', level: 'error', options: {
            destination: 'ROUTE-TO-FILE'
          } },
        ],
      },
    "emailConfig": {
        "host": "smtp_host",
        "port": 25,
        "auth": {
            "user": "user",
            "pass": "password",
            "from": "from_mail"
        }
    }
}