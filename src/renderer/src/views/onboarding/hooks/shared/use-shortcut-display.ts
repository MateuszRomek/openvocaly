import { useMemo } from 'react'
import type { ShortcutAction } from '../../../../../../shared/shortcuts'
import { ONBOARDING_RECOMMENDED_SHORTCUT } from '../../constants/onboarding'
import { toDisplayAccelerator } from '../../helpers/shortcut-accelerator'
import { useOnboardingShortcutsConfigQuery } from '../../queries/shortcuts/use-onboarding-shortcuts-config-query'

type UseShortcutDisplayOptions = {
  action?: ShortcutAction
  fallbackAccelerator?: string
}

export type UseShortcutDisplayResult = {
  accelerator: string
  display: string
  tokens: string[]
}

export function useShortcutDisplay(options?: UseShortcutDisplayOptions): UseShortcutDisplayResult {
  const action = options?.action ?? 'recording.toggle'
  const fallbackAccelerator = options?.fallbackAccelerator ?? ONBOARDING_RECOMMENDED_SHORTCUT
  const shortcutsConfigQuery = useOnboardingShortcutsConfigQuery()
  const platform = window.api.system.platform

  const accelerator = useMemo(() => {
    return (
      shortcutsConfigQuery.data?.actions.find((shortcutAction) => shortcutAction.action === action)
        ?.accelerator ?? fallbackAccelerator
    )
  }, [action, fallbackAccelerator, shortcutsConfigQuery.data?.actions])

  const display = toDisplayAccelerator(accelerator, platform)

  const tokens = useMemo(() => {
    return display
      .split(/\s*\+\s*/g)
      .map((token) => token.trim())
      .filter(Boolean)
  }, [display])

  return {
    accelerator,
    display,
    tokens
  }
}
