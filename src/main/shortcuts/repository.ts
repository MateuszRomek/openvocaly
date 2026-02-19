import { getDb } from '../db'
import { shortcutBindings } from '../../shared/schema'
import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_ACTIONS,
  isShortcutAction,
  type ShortcutAction
} from '../../shared/shortcuts'

const now = (): number => Date.now()

export const ensureDefaultShortcutBindings = (): void => {
  const db = getDb()
  const updatedAt = now()

  for (const action of SHORTCUT_ACTIONS) {
    db.insert(shortcutBindings)
      .values({
        action,
        accelerator: DEFAULT_SHORTCUT_BINDINGS[action],
        updatedAt
      })
      .onConflictDoNothing()
      .run()
  }
}

export const listShortcutBindings = (): Record<ShortcutAction, string> => {
  const db = getDb()
  const rows = db.select().from(shortcutBindings).all()
  const bindings: Record<ShortcutAction, string> = { ...DEFAULT_SHORTCUT_BINDINGS }

  for (const row of rows) {
    if (isShortcutAction(row.action)) {
      bindings[row.action] = row.accelerator
    }
  }

  return bindings
}

export const setShortcutBinding = (action: ShortcutAction, accelerator: string): void => {
  const db = getDb()

  db.insert(shortcutBindings)
    .values({
      action,
      accelerator,
      updatedAt: now()
    })
    .onConflictDoUpdate({
      target: shortcutBindings.action,
      set: {
        accelerator,
        updatedAt: now()
      }
    })
    .run()
}

export const isShortcutAcceleratorUniqueConstraintError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.includes('shortcut_bindings.accelerator')
}
