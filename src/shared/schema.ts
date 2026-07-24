import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    startedAt: integer('started_at').notNull(),
    durationMs: integer('duration_ms'),
    title: text('title'),
    source: text('source'),
    targetAppName: text('target_app_name'),
    targetAppIdentifier: text('target_app_identifier'),
    targetAppPath: text('target_app_path')
  },
  (table) => [
    index('sessions_started_at_idx').on(table.startedAt),
    index('sessions_target_app_identifier_idx').on(table.targetAppIdentifier)
  ]
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

export const meetings = sqliteTable(
  'meetings',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    sourceFileName: text('source_file_name').notNull(),
    sourceFilePath: text('source_file_path').notNull(),
    status: text('status').notNull(),
    providerId: text('provider_id').notNull(),
    modelId: text('model_id').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    durationMs: integer('duration_ms'),
    completedChunks: integer('completed_chunks').notNull().default(0),
    totalChunks: integer('total_chunks').notNull().default(0),
    errorMessage: text('error_message')
  },
  (table) => [
    index('meetings_created_at_idx').on(table.createdAt),
    index('meetings_status_idx').on(table.status)
  ]
)

export const meetingSegments = sqliteTable(
  'meeting_segments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    meetingId: text('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (table) => [
    uniqueIndex('meeting_segments_meeting_chunk_unique').on(table.meetingId, table.chunkIndex),
    index('meeting_segments_meeting_id_idx').on(table.meetingId)
  ]
)

export const sessionMetrics = sqliteTable(
  'session_metrics',
  {
    sessionId: integer('session_id')
      .primaryKey()
      .references(() => sessions.id),
    wordCount: integer('word_count').notNull(),
    durationMsEffective: integer('duration_ms_effective').notNull(),
    computedAt: integer('computed_at').notNull()
  },
  (table) => [index('session_metrics_computed_at_idx').on(table.computedAt)]
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
