import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'drizzle-kit'

const appDbPath = join(homedir(), 'Library', 'Application Support', 'OpenVocaly', 'openvocaly.db')

export default defineConfig({
  schema: './src/shared/schema.ts',
  out: './resources/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${appDbPath}`
  }
})
