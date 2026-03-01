import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    startedAt: integer('started_at').notNull(),
    durationMs: integer('duration_ms'),
    title: text('title'),
    source: text('source')
  },
  (table) => [index('sessions_started_at_idx').on(table.startedAt)]
)

export const transcripts = sqliteTable(
  'transcripts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    createdAt: integer('created_at').notNull(),
    text: text('text').notNull(),
    language: text('language'),
    confidence: real('confidence'),
    durationMs: integer('duration_ms')
  },
  (table) => [
    index('transcripts_session_id_idx').on(table.sessionId),
    index('transcripts_created_at_idx').on(table.createdAt)
  ]
)

export const shortcutBindings = sqliteTable(
  'shortcut_bindings',
  {
    action: text('action').primaryKey(),
    accelerator: text('accelerator').notNull().unique(),
    key: text('key').notNull(),
    modCmd: integer('mod_cmd').notNull(),
    modCtrl: integer('mod_ctrl').notNull(),
    modAlt: integer('mod_alt').notNull(),
    modShift: integer('mod_shift').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('shortcut_bindings_key_modifiers_unique').on(
      table.key,
      table.modCmd,
      table.modCtrl,
      table.modAlt,
      table.modShift
    )
  ]
)

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: integer('updated_at').notNull()
})
