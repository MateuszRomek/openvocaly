const { copyFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')

const root = process.cwd()
const envPath = join(root, '.env')
const envExamplePath = join(root, '.env.example')

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath)
  console.log('Created .env from .env.example')
} else {
  console.log('.env already exists, skipping copy')
}

console.log('Running database migrations...')
