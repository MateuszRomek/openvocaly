import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/shared/schema.ts',
  out: './resources/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./resources/db/dev.sqlite'
  }
})
