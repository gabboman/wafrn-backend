import 'dotenv/config' // make sure to install dotenv package
import type { Config } from 'drizzle-kit'
import { environment } from './environment'

export default {
  driver: 'mysql2',
  //out: './src/drizzle',
  //schema: './src/drizzle/schema.ts',
  dbCredentials: {
    uri: environment.databaseConnectionString
  },
  // Print all statements
  verbose: true,
  // Always ask for confirmation
  strict: true
} satisfies Config
