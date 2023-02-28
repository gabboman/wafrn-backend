import { environment } from "../environment"

const pino = require('pino')
const transport = pino.transport(environment.pinoTransportOptions)

export const logger = require('pino')(transport)