import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { RECORDING_OVERLAY_STATE_CHANNEL, type RecordingOverlayState } from '../../shared/recording'
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
  toBarVisuals,
  toTargetBars
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
  const currentPhaseRef = useRef<RecordingOverlayState['phase']>('starting')
  const targetBarsRef = useRef<number[]>(createBars(0))
  const renderedBarsRef = useRef<number[]>(createBars(0.08))
  const barElementsRef = useRef<Array<HTMLSpanElement | null>>(createBars(0).map(() => null))
  const mountedRef = useRef(false)

  const barIndexes = createBarIndexes()

  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
  }, [])

  useEffect(() => {
    mountedRef.current = true

    const detach = window.electron.ipcRenderer.on(
      RECORDING_OVERLAY_STATE_CHANNEL,
      (_event, state: RecordingOverlayState) => {
        currentPhaseRef.current = state.phase
        targetBarsRef.current = toTargetBars(state)
      }
    )

    return () => {
      mountedRef.current = false
      detach()
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

  return (
    <div className="pointer-events-none flex h-full w-full items-center justify-center select-none">
      <div
        className="h-full w-full rounded-full border border-border/60 bg-background/95 px-5 py-2.5"
        role="presentation"
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
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlayVisualizer />
  </StrictMode>
)
