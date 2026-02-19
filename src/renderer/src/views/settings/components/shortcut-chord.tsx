import { Kbd, KbdGroup } from '@renderer/ui/kbd'
import { splitAccelerator, toDisplayToken } from '../helpers/shortcut-accelerator'
import type { ShortcutPlatform } from '../queries/shortcuts/shortcuts.types'

type ShortcutChordProps = {
  accelerator: string | null
  platform: ShortcutPlatform
  compact?: boolean
}

export function ShortcutChord({
  accelerator,
  platform,
  compact = false
}: ShortcutChordProps): React.JSX.Element {
  if (!accelerator) {
    return <span className="text-muted-foreground text-sm italic">Not set</span>
  }

  const tokens = splitAccelerator(accelerator)

  const keyClassName = compact
    ? 'h-8 min-w-8 rounded-md px-2.5 text-[13px] font-semibold'
    : 'h-9 min-w-9 rounded-md px-3 text-sm font-semibold'

  return (
    <KbdGroup className="flex flex-wrap justify-center gap-1.5">
      {tokens.map((token, index) => (
        <Kbd key={`${token}-${index}`} className={keyClassName}>
          {toDisplayToken(token, platform)}
        </Kbd>
      ))}
    </KbdGroup>
  )
}
