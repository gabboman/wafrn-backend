import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { activityPubRoutes } from './routes/activitypub/activitypub'
import overrideContentType from './utils/overrideContentType'

import { environment } from './environment'
import { logger } from './utils/logger'
import { wellKnownRoutes } from './routes/activitypub/well-known'

// rest of the code remains same
const app = express()
const PORT = environment.fediPort

app.use(overrideContentType)
app.use(bodyParser.json())
app.use(cors())
app.set('trust proxy', 1)

wellKnownRoutes(app)
activityPubRoutes(app)

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`FEDIVERSE SERVER is running at https://localhost:${PORT}`)
})
