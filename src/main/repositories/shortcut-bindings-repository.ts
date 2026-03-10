import { getDb } from '../db'
import { shortcutBindings } from '../../shared/schema'
import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_ACTIONS,
  isShortcutAction,
  type ShortcutAction
} from '../../shared/shortcuts'
import {
  parseAccelerator,
  toPersistedShortcutBinding,
  type PersistedShortcutBinding
} from '../shortcuts/accelerator'

const now = (): number => Date.now()

const toDbModifiers = (
  modifiers: PersistedShortcutBinding['modifiers']
): {
  modCmd: number
  modCtrl: number
  modAlt: number
  modShift: number
} => ({
  modCmd: modifiers.cmd ? 1 : 0,
  modCtrl: modifiers.ctrl ? 1 : 0,
  modAlt: modifiers.alt ? 1 : 0,
  modShift: modifiers.shift ? 1 : 0
})

const fromDbModifiers = (row: {
  modCmd: number
  modCtrl: number
  modAlt: number
  modShift: number
}): PersistedShortcutBinding['modifiers'] => ({
  cmd: row.modCmd === 1,
  ctrl: row.modCtrl === 1,
  alt: row.modAlt === 1,
  shift: row.modShift === 1
})

export class ShortcutBindingsRepository {
  async ensureDefaultBindings(): Promise<void> {
    const db = getDb()
    const updatedAt = now()

    for (const action of SHORTCUT_ACTIONS) {
      const parsedDefault = parseAccelerator(DEFAULT_SHORTCUT_BINDINGS[action])
      if (!parsedDefault) {
        continue
      }

      const binding = toPersistedShortcutBinding(parsedDefault)

      await db
        .insert(shortcutBindings)
        .values({
          action,
          accelerator: binding.accelerator,
          key: binding.key,
          ...toDbModifiers(binding.modifiers),
          updatedAt
        })
        .onConflictDoNothing()
        .run()
    }
  }

  async listBindings(): Promise<Record<ShortcutAction, PersistedShortcutBinding>> {
    const db = getDb()
    const rows = await db.select().from(shortcutBindings).all()
    const bindings: Record<ShortcutAction, PersistedShortcutBinding> = SHORTCUT_ACTIONS.reduce(
      (acc, action) => {
        const parsedDefault = parseAccelerator(DEFAULT_SHORTCUT_BINDINGS[action])
        if (!parsedDefault) {
          throw new Error(`Invalid default shortcut binding for ${action}`)
        }

        acc[action] = toPersistedShortcutBinding(parsedDefault)
        return acc
      },
      {} as Record<ShortcutAction, PersistedShortcutBinding>
    )

    for (const row of rows) {
      if (isShortcutAction(row.action)) {
        bindings[row.action] = {
          accelerator: row.accelerator,
          key: row.key,
          modifiers: fromDbModifiers(row)
        }
      }
    }

    return bindings
  }

  async setBinding(action: ShortcutAction, binding: PersistedShortcutBinding): Promise<void> {
    const db = getDb()

    await db
      .insert(shortcutBindings)
      .values({
        action,
        accelerator: binding.accelerator,
        key: binding.key,
        ...toDbModifiers(binding.modifiers),
        updatedAt: now()
      })
      .onConflictDoUpdate({
        target: shortcutBindings.action,
        set: {
          accelerator: binding.accelerator,
          key: binding.key,
          ...toDbModifiers(binding.modifiers),
          updatedAt: now()
        }
      })
      .run()
  }

  isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false
    }

    const message = error.message

    // SQLite reports uniqueness violations using constrained column names.
    const isAcceleratorUniqueViolation =
      message.includes('UNIQUE constraint failed: shortcut_bindings.accelerator') ||
      message.includes('shortcut_bindings_accelerator_unique')

    const isKeyModifierUniqueViolation =
      message.includes('shortcut_bindings_key_modifiers_unique') ||
      (message.includes('UNIQUE constraint failed') &&
        message.includes('shortcut_bindings.key') &&
        message.includes('shortcut_bindings.mod_cmd') &&
        message.includes('shortcut_bindings.mod_ctrl') &&
        message.includes('shortcut_bindings.mod_alt') &&
        message.includes('shortcut_bindings.mod_shift'))

    return isAcceleratorUniqueViolation || isKeyModifierUniqueViolation
  }
}
