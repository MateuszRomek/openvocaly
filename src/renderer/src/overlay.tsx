import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import type { DictationOverlayState } from '../../shared/dictation'
import { Kbd } from '@renderer/ui/kbd'
import { useOverlayIpcState } from '@renderer/hooks/use-overlay-ipc-state'
import { isMacOS } from '@renderer/lib/platform'
import './assets/main.css'
import { startThemeSync } from './lib/theme'
import {
  BAR_COUNT,
  IDLE_OPACITY_BASE,
  IDLE_SCALE_FLOOR,
  createBarIndexes,
  createBars,
  getBarSmoothing,
  resolveBarTarget,
  toBarVisuals
} from './overlay-visualizer-helpers'

const stopThemeSync = startThemeSync()
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopThemeSync()
  })
}

/**
 * Overlay renderer for live recording feedback.
 *
 * This component intentionally keeps high-frequency visualization state in refs
 * and mutates DOM styles in a single RAF loop to avoid React re-render churn.
 */
export function OverlayVisualizer(): React.JSX.Element {
  // IPC updates and frame-to-frame interpolation run at high frequency.
  // Refs keep this loop off React state updates for smoother animation.
  const currentPhaseRef = useRef<DictationOverlayState['phase']>('starting')
  const targetBarsRef = useRef<number[]>(createBars(0))
  const renderedBarsRef = useRef<number[]>(createBars(0.08))
  const barElementsRef = useRef<Array<HTMLSpanElement | null>>(createBars(0).map(() => null))
  const mountedRef = useRef(false)
  const hasMessageRef = useRef(false)
  const { message, manualPasteState } = useOverlayIpcState({
    currentPhaseRef,
    targetBarsRef,
    hasMessageRef
  })

  const barIndexes = createBarIndexes()
  const pasteModifierLabel = isMacOS() ? 'Cmd' : 'Ctrl'

  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
  }, [])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let frameId: number | null = null

    // Single animation loop applies interpolated bar styles on each frame.
    const renderFrame = (): void => {
      if (!mountedRef.current || document.visibilityState !== 'visible') {
        frameId = null
        return
      }

      const phase = currentPhaseRef.current
      const now = performance.now() / 1000

      if (hasMessageRef.current) {
        frameId = window.requestAnimationFrame(renderFrame)
        return
      }

      for (let index = 0; index < BAR_COUNT; index += 1) {
        const element = barElementsRef.current[index]

        if (!element) {
          continue
        }

        const nextValue = resolveBarTarget(phase, index, now, targetBarsRef.current[index] ?? 0)

        const previous = renderedBarsRef.current[index] ?? 0.08
        const smoothing = getBarSmoothing(phase)
        const current = previous + (nextValue - previous) * smoothing
        renderedBarsRef.current[index] = current

        const { scale, opacity } = toBarVisuals(current)

        element.style.transform = `scaleY(${scale.toFixed(3)})`
        element.style.opacity = `${opacity.toFixed(3)}`
      }

      frameId = window.requestAnimationFrame(renderFrame)
    }

    const startAnimation = (): void => {
      if (!mountedRef.current || document.visibilityState !== 'visible' || frameId !== null) {
        return
      }

      frameId = window.requestAnimationFrame(renderFrame)
    }

    const stopAnimation = (): void => {
      if (frameId === null) {
        return
      }

      window.cancelAnimationFrame(frameId)
      frameId = null
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        startAnimation()
        return
      }

      stopAnimation()
    }

    startAnimation()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopAnimation()
    }
  }, [])

  const manualPasteProgress = manualPasteState
    ? Math.max(
        0,
        Math.min(1, manualPasteState.remainingMs / Math.max(1, manualPasteState.timeoutMs))
      )
    : 0
  const showMessageLayer = Boolean(message) || Boolean(manualPasteState)

  return (
    <div className="pointer-events-none flex h-full w-full items-center justify-center select-none">
      <div
        className="relative h-full w-full overflow-hidden rounded-full border border-border/60 bg-background/95"
        role="presentation"
      >
        <div
          className={`absolute inset-0 px-5 py-2.5 transition-opacity duration-180 ease-out ${
            showMessageLayer ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="flex h-full w-full items-center justify-between">
            {barIndexes.map((index) => (
              <span
                key={index}
                ref={(element) => {
                  barElementsRef.current[index] = element
                }}
                className="h-full min-h-[2px] w-[4px] origin-center rounded-full bg-foreground will-change-transform"
                style={{ transform: `scaleY(${IDLE_SCALE_FLOOR})`, opacity: IDLE_OPACITY_BASE }}
              />
            ))}
          </div>
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-center px-4 text-center text-[13px] font-medium tracking-[0.01em] text-foreground transition-opacity duration-180 ease-out ${
            showMessageLayer ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {manualPasteState ? (
            <div className="w-full max-w-[94%] py-1.5">
              <div className="flex items-center justify-center gap-1.5 text-[12px]">
                <span className="text-foreground/72">Paste</span>
                <Kbd className="h-[18px] min-w-6 rounded px-1.5 text-[11px] font-semibold">
                  {pasteModifierLabel}
                </Kbd>
                <span className="text-foreground/45">+</span>
                <Kbd className="h-[18px] min-w-[18px] rounded px-1.5 text-[11px] font-semibold">
                  V
                </Kbd>
                <span className="mx-0.5 text-foreground/30">•</span>
                <span className="text-foreground/72">Cancel</span>
                <Kbd className="h-[18px] min-w-[18px] rounded px-1.5 text-[11px] font-semibold">
                  Esc
                </Kbd>
              </div>
              <div className="mx-auto mt-2.5 h-1.5 w-[84%] max-w-[212px] overflow-hidden rounded-full bg-foreground/16">
                <span
                  className="block h-full rounded-full bg-foreground/80 transition-[width] duration-180 ease-out"
                  style={{ width: `${(manualPasteProgress * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="max-h-[48px] max-w-[92%] overflow-hidden break-words whitespace-pre-wrap leading-[1.22]">
              {message ?? ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlayVisualizer />
  </StrictMode>
)
