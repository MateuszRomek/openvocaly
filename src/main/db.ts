import { createClient, type Client } from '@libsql/client'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

let db: LibSQLDatabase | null = null
let client: Client | null = null

export const initDb = async (): Promise<LibSQLDatabase> => {
  if (db) {
    return db
  }

  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'openvocaly.db')

  client = createClient({ url: `file:${dbPath}` })
  await client.execute('PRAGMA journal_mode = WAL')
  await client.execute('PRAGMA foreign_keys = ON')

  db = drizzle({ client })
  await migrate(db, { migrationsFolder: resolveMigrationsPath() })

  return db
}

const resolveMigrationsPath = (): string => {
  const devPath = join(app.getAppPath(), 'resources', 'db', 'migrations')

  if (!app.isPackaged) {
    return devPath
  }

  const unpackedPath = join(
    process.resourcesPath,
    'app.asar.unpacked',
    'resources',
    'db',
    'migrations'
  )

  if (existsSync(unpackedPath)) {
    return unpackedPath
  }

  return devPath
}

export const getDb = (): LibSQLDatabase => {
  if (!db) {
    throw new Error('Database not initialized')
  }

  return db
}

export const closeDb = (): void => {
  client?.close()
  client = null
  db = null
}
