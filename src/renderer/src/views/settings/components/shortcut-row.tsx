import { RotateCcwIcon } from 'lucide-react'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Kbd } from '@renderer/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/ui/tooltip'
import { ShortcutChord } from './shortcut-chord'
import { useShortcutRow } from '../hooks/use-shortcut-row'
import type { ShortcutActionConfig, ShortcutPlatform } from '../queries/shortcuts/shortcuts.types'
import type { ShortcutRowController } from '../hooks/use-shortcut-settings'

type ShortcutRowProps = {
  item: ShortcutActionConfig
  index: number
  total: number
  platform: ShortcutPlatform
  rowController: ShortcutRowController
}

export function ShortcutRow({
  item,
  index,
  total,
  platform,
  rowController
}: ShortcutRowProps): React.JSX.Element {
  const row = useShortcutRow({
    item,
    index,
    total,
    rowController
  })

  return (
    <article
      key={item.action}
      className={`flex min-h-[7.5rem] items-center gap-3 px-5 py-5 ${row.isLast ? '' : 'border-border/40 border-b'}`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-medium">{row.meta.label}</h3>
          {!item.isSupportedGlobal && (
            <Badge variant="secondary" className="h-5 px-2 text-[11px]">
              Planned
            </Badge>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Reset ${row.meta.label} to default`}
                  onClick={row.onReset}
                  disabled={row.isMutating}
                />
              }
            >
              <RotateCcwIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Reset to default</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-muted-foreground text-sm">{row.meta.description}</p>
        {row.runtimeError && <p className="text-destructive text-xs">{row.runtimeError}</p>}
        {row.draftError && <p className="text-destructive text-xs">{row.draftError}</p>}
        {!item.isSupportedGlobal && row.unsupportedMessage && (
          <p className="text-muted-foreground text-xs">{row.unsupportedMessage}</p>
        )}
      </div>

      <div className="w-[11rem] shrink-0 space-y-2">
        <Button
          variant="outline"
          size="default"
          onClick={row.onBeginEditing}
          onKeyDown={row.onCaptureKeyDown}
          onBlur={row.onBlur}
          autoFocus={row.isEditingThisRow}
          disabled={!item.isSupportedGlobal || row.isMutating}
          className={`border-border/45 focus-visible:border-ring/60 focus-visible:ring-ring/35 min-h-14 w-full justify-center rounded-xl bg-muted/6 px-2 py-2 text-center transition-all duration-200 ${row.surfaceClass} ${row.activeCaptureClass}`}
        >
          {row.isEditingThisRow ? (
            <div className="w-full space-y-1">
              <ShortcutChord accelerator={row.displayedAccelerator} platform={platform} compact />
            </div>
          ) : (
            <div className="w-full">
              <ShortcutChord accelerator={row.displayedAccelerator} platform={platform} compact />
            </div>
          )}
        </Button>
        <p
          className={`text-muted-foreground flex h-6 items-center justify-center text-center text-[11px] whitespace-nowrap transition-opacity ${
            row.isEditingThisRow ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Listening now. Press <Kbd className="mx-1 h-5 min-w-6 px-2.5">Esc</Kbd> to cancel.
        </p>
      </div>
    </article>
  )
}
