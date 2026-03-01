import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { RECORDING_OVERLAY_STATE_CHANNEL, type RecordingOverlayState } from '../../shared/recording'
import './assets/main.css'
import { startThemeSync } from './lib/theme'
import {
  BAR_COUNT,
  IDLE_OPACITY_BASE,
  IDLE_SCALE_FLOOR,
  clamp01,
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

export function OverlayVisualizer(): React.JSX.Element {
  const currentPhaseRef = useRef<RecordingOverlayState['phase']>('starting')
  const targetLevelRef = useRef(0)
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
        targetLevelRef.current = clamp01(state.meterLevel)
        targetBarsRef.current = toTargetBars(state)
      }
    )

    return () => {
      mountedRef.current = false
      detach()
    }
  }, [])

  useEffect(() => {
    let frameId = 0

    const renderFrame = (): void => {
      if (!mountedRef.current) {
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

    frameId = window.requestAnimationFrame(renderFrame)

    return () => {
      window.cancelAnimationFrame(frameId)
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
