export const environment = {
  prod: true,
  // this makes the logs really heavy, but might be useful for queries
  logSQLQueries: false,
  // VERY IMPORTANT. This to true DESTROYS YOUR FUCKING DATABASE. DO NOT. DO NOT. DO NOT. You set it to true the first time, create the admin user, then stop, set forcesync to false and enjoy
  forceSync: false,
  workers: {
    // if you set this to true, workers will start in the main thread. no need for starting the utils/workers.ts in other tmux tab
    mainThread: true,
    low: 2,
    medium: 10,
    high: 25
  },
  //YOU SHOULD TOTALLY USE MYSQL AND DO NOT COMMIT THE SAME MISTAKES AS ME. Mariadb works, but there were some performance issues because indexes
  databaseConnectionString: 'mysql://user:password@127.0.0.1/wafrn',
  port: 3000,
  listenIp: '127.0.0.1',
  saltRounds: 12,
  // for jwt secret you should use something like https://www.grc.com/passwords.htm please this is SUPER DUPER SECRET.
  jwtSecret: 'JWTSECRET',
  // https://app.wafrn.net
  frontendUrl: 'FEDIVERSE_URL_WITH_HTTPS',
  // app.wafrn.net
  instanceUrl: 'FEDIVERSE_URL_NO_PROTOCOL',
  // https://media.wafrn.net
  mediaUrl: 'MEDIA_URL_OR_API_URL',
  // You should run also this project github.com/gabboman/fediversemediacacher. In my case, https://cache.wafrn.net/?media= The cache is there because at some point in the past I configured it to precache images. No need for it to be honest
  externalCacheurl: 'FEDIVERSE_CACHE_URL_SAME_AS_ENVIRONMENT',
  // this was a dev thing. leave to true unless you are doing stuff in local or your media url is yourinstance/uploads (not recomended)
  removeFolderNameFromFileUploads: true,
  // after the first run, create the admin user. and a deleted user
  adminUser: 'ADMIN_USER_URL',
  // after creating the deleted_user we advice to also set the user to BANNED
  deleted_user: '@deleted_user',
  // in MB. Please make sure you have the same in the frontend
  uploadSize: 50,
  // 20 is a good number. more could take too much to load, 10 might be "faster" but you do loads more often and you see the loader a bit more
  postsPerPage: 20,
  // The frontend files. This one is where the compiled angular app will be. We recomend something like this
  frontedLocation: '/home/wafrn/frontend/',
  // trace is extreme logging. debug is ok for now
  logLevel: 'debug',
  // we now are not sure if its a good enough blocklist. There is a script that loads the file from here.
  blocklistUrl: 'https://codeberg.org/oliphant/blocklists/raw/branch/main/blocklists/_unified_tier0_blocklist.csv',
  // oh yes, you need redis
  bullmqConnection: {
    host: 'localhost',
    port: 6379
  },
  // I recomend using a different internal redis db than the bullmq one for caching stuff
  redisioConnection: {
    host: 'localhost',
    port: 6379,
    db: 2
  },
  // this will create a backendlog.log file on the folder superior to this one.
  pinoTransportOptions: {
    targets: [
      {
        target: 'pino/file',
        level: 0,
        options: {
          destination: '../backendlog.log'
        }
      }
    ]
  },
  // you can try with gmail but we actually use sendinblue for this. bear in mind that this might require some fiddling in your gmail account too
  // you might need to enable https://myaccount.google.com/lesssecureapps
  // https://miracleio.me/snippets/use-gmail-with-nodemailer/
  emailConfig: {
    host: 'smtp_host',
    port: 25,
    auth: {
      user: 'user',
      pass: 'password',
      from: 'from_mail'
    }
  },
  // if someone is trying to scrap your place you can send a funny message in some petitions (attacks to the frontend)
  blockedIps: []
}
