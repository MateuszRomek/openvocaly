import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

let db: BetterSQLite3Database | null = null
let sqlite: Database.Database | null = null

export const initDb = (): BetterSQLite3Database => {
  if (db) {
    return db
  }

  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'wispr.db')

  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  db = drizzle(sqlite)
  migrate(db, { migrationsFolder: resolveMigrationsPath() })

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

export const getDb = (): BetterSQLite3Database => {
  if (!db) {
    throw new Error('Database not initialized')
  }

  return db
}

export const closeDb = (): void => {
  sqlite?.close()
  sqlite = null
  db = null
}
