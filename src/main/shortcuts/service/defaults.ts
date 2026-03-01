import {
  DEFAULT_SHORTCUT_BINDINGS,
  SHORTCUT_ACTIONS,
  type ShortcutAction
} from '../../../shared/shortcuts'
import {
  parseAccelerator,
  toPersistedShortcutBinding,
  type PersistedShortcutBinding
} from '../accelerator'

export const createDefaultBindings = (): Record<ShortcutAction, PersistedShortcutBinding> =>
  SHORTCUT_ACTIONS.reduce(
    (acc, action) => {
      const parsed = parseAccelerator(DEFAULT_SHORTCUT_BINDINGS[action])
      if (!parsed) {
        throw new Error(`Invalid default shortcut binding for ${action}`)
      }

      acc[action] = toPersistedShortcutBinding(parsed)
      return acc
    },
    {} as Record<ShortcutAction, PersistedShortcutBinding>
  )

export const defaultBindingForAction = (action: ShortcutAction): PersistedShortcutBinding => {
  const parsed = parseAccelerator(DEFAULT_SHORTCUT_BINDINGS[action])

  if (!parsed) {
    throw new Error(`Invalid default shortcut binding for ${action}`)
  }

  return toPersistedShortcutBinding(parsed)
}
