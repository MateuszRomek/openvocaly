import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@renderer/lib/utils'

type OpenVocalyLogoSharpness = 'exact' | 'pixel-snapped'
type OpenVocalyLogoBarPattern = 'five' | 'three'
type OpenVocalyLogoBarAnimation = 'speaking' | 'static-reveal'

type OpenVocalyLogoTuning = {
  sharpness?: OpenVocalyLogoSharpness
  barPattern?: OpenVocalyLogoBarPattern
  pixelRatio?: number
  circleGap?: number
  circleStroke?: number
  barWidth?: number
  barRadius?: number
  barMinHeight?: number
  barMaxHeight?: number
}

type OpenVocalyLogoProps = {
  size?: number
  className?: string
  animate?: boolean
  animateOnce?: boolean
  animationKey?: string
  animationSpeed?: number
  barAnimation?: OpenVocalyLogoBarAnimation
  onAnimationComplete?: () => void
  tuning?: OpenVocalyLogoTuning
}

type BarShape = {
  x: number
  y: number
  h: number
}

type RenderBarShape = {
  x: number
  y: number
  h: number
  w: number
  rx: number
}

type LogoGeometry = {
  sharpness: OpenVocalyLogoSharpness
  snapScale: number
  circleRadius: number
  circleGap: number
  circleLength: number
  circleDash: number
  circleStroke: number
  barCenter: number
  barMinHeight: number
  barMaxHeight: number
  finalBars: RenderBarShape[]
}

const VIEWBOX_SIZE = 120
const CIRCLE_CENTER = 60
const CIRCLE_RADIUS = 50
const CIRCLE_GAP = 22
const CIRCLE_STROKE = 8
const BAR_WIDTH = 7
const BAR_RADIUS = 3.5
const BAR_CENTER = 60
const BAR_MIN_HEIGHT = 8
const BAR_MAX_HEIGHT = 48

const FIVE_BAR_SHAPES: BarShape[] = [
  { x: 35, y: 40, h: 44 },
  { x: 46.5, y: 52, h: 32 },
  { x: 56.5, y: 60, h: 24 },
  { x: 67.5, y: 52, h: 32 },
  { x: 78, y: 40, h: 44 }
]

const THREE_BAR_SHAPES: BarShape[] = [
  { x: 40.5, y: 40, h: 44 },
  { x: 56.5, y: 52, h: 32 },
  { x: 72.5, y: 40, h: 44 }
]

const BAR_SHAPES_BY_PATTERN: Record<OpenVocalyLogoBarPattern, BarShape[]> = {
  five: FIVE_BAR_SHAPES,
  three: THREE_BAR_SHAPES
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3
const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

const snapToScale = (value: number, scale: number): number => Math.round(value * scale) / scale

const formatSvgValue = (
  value: number,
  sharpness: OpenVocalyLogoSharpness,
  snapScale: number
): string => {
  const finalValue = sharpness === 'pixel-snapped' ? snapToScale(value, snapScale) : value
  return finalValue.toFixed(2)
}

const getSnapScale = (size: number, pixelRatio?: number): number => {
  const dpr = pixelRatio ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
  return Math.max(0.001, (size * Math.max(1, dpr)) / VIEWBOX_SIZE)
}

const clampPositive = (value: number, minValue: number): number =>
  Number.isFinite(value) ? Math.max(minValue, value) : minValue

const playedAnimationKeys = new Set<string>()

function OpenVocalyLogo({
  size = 28,
  className,
  animate = true,
  animateOnce = true,
  animationKey,
  animationSpeed = 1,
  barAnimation = 'speaking',
  onAnimationComplete,
  tuning
}: OpenVocalyLogoProps): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const circleRef = useRef<SVGCircleElement | null>(null)

  const geometry = useMemo<LogoGeometry>(() => {
    const sharpness = tuning?.sharpness ?? 'pixel-snapped'
    const barPattern = tuning?.barPattern ?? 'five'
    const snapScale = getSnapScale(size, tuning?.pixelRatio)
    const shouldSnap = sharpness === 'pixel-snapped'
    const minStep = 1 / snapScale
    const barShapes = BAR_SHAPES_BY_PATTERN[barPattern]

    const snapValue = (value: number): number =>
      shouldSnap ? snapToScale(value, snapScale) : value

    const snapSpan = (start: number, span: number): { start: number; span: number } => {
      if (!shouldSnap) {
        return { start, span }
      }

      const snappedStart = snapValue(start)
      const snappedEnd = snapValue(start + span)
      return {
        start: snappedStart,
        span: Math.max(minStep, snappedEnd - snappedStart)
      }
    }

    const circleRadius = snapValue(CIRCLE_RADIUS)
    const circleGap = clampPositive(snapValue(tuning?.circleGap ?? CIRCLE_GAP), minStep)
    const circleStroke = clampPositive(snapValue(tuning?.circleStroke ?? CIRCLE_STROKE), minStep)
    const circleLength = 2 * Math.PI * circleRadius
    const circleDash = Math.max(minStep, circleLength - circleGap)

    const baseBarWidth = clampPositive(tuning?.barWidth ?? BAR_WIDTH, minStep)
    const baseBarRadius = clampPositive(tuning?.barRadius ?? BAR_RADIUS, 0)

    const finalBars = barShapes.map((shape) => {
      const snappedX = snapSpan(shape.x, baseBarWidth)
      const snappedY = snapSpan(shape.y, shape.h)
      const rx = Math.min(snappedX.span / 2, snappedY.span / 2, snapValue(baseBarRadius))

      return {
        x: snappedX.start,
        y: snappedY.start,
        h: snappedY.span,
        w: snappedX.span,
        rx
      }
    })

    return {
      sharpness,
      snapScale,
      circleRadius,
      circleGap,
      circleLength,
      circleDash,
      circleStroke,
      barCenter: snapValue(BAR_CENTER),
      barMinHeight: clampPositive(snapValue(tuning?.barMinHeight ?? BAR_MIN_HEIGHT), minStep),
      barMaxHeight: clampPositive(snapValue(tuning?.barMaxHeight ?? BAR_MAX_HEIGHT), minStep),
      finalBars
    }
  }, [size, tuning])

  useEffect(() => {
    const circle = circleRef.current
    const bars = Array.from(
      svgRef.current?.querySelectorAll<SVGRectElement>('[data-logo-bar]') ?? []
    )

    if (!circle || bars.length !== geometry.finalBars.length) {
      return
    }

    const toSvg = (value: number): string =>
      formatSvgValue(value, geometry.sharpness, geometry.snapScale)

    const applyStaticState = (): void => {
      circle.style.transition = 'none'
      circle.style.strokeDasharray = `${geometry.circleDash} ${geometry.circleGap}`
      circle.style.transform = 'rotate(-45deg)'
      circle.style.transformOrigin = '60px 60px'

      bars.forEach((bar, index) => {
        const shape = geometry.finalBars[index]
        bar.setAttribute('y', toSvg(shape.y))
        bar.setAttribute('height', toSvg(shape.h))
        bar.style.opacity = '1'
      })
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const hasPlayedByKey = Boolean(animationKey && playedAnimationKeys.has(animationKey))

    if (!animate || prefersReducedMotion || (animateOnce && hasPlayedByKey)) {
      applyStaticState()
      onAnimationComplete?.()
      return
    }

    const speed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 1
    const ringDrawDuration = 3600 * speed
    let rafId = 0
    const barsState = bars.map(() => ({
      current: 0,
      velocity: 0,
      target: 0,
      nextChange: 0
    }))

    circle.style.transition = 'none'
    circle.style.strokeDasharray = `0 ${geometry.circleLength}`
    circle.style.transform = 'rotate(-45deg)'
    circle.style.transformOrigin = '60px 60px'

    bars.forEach((bar) => {
      bar.style.opacity = '1'
      if (barAnimation === 'static-reveal') {
        return
      }

      bar.setAttribute('y', toSvg(geometry.barCenter))
      bar.setAttribute('height', '0')
    })

    if (barAnimation === 'static-reveal') {
      bars.forEach((bar, index) => {
        const finalShape = geometry.finalBars[index]
        bar.setAttribute('y', toSvg(finalShape.y))
        bar.setAttribute('height', toSvg(finalShape.h))
        bar.style.opacity = '0'
      })
    }

    requestAnimationFrame(() => {
      circle.style.transition = `stroke-dasharray ${ringDrawDuration / 1000}s cubic-bezier(0.2, 0.75, 0.2, 1)`
      circle.style.strokeDasharray = `${geometry.circleDash} ${geometry.circleGap}`
    })

    const start = performance.now()

    const tick =
      barAnimation === 'speaking'
        ? (now: number): void => {
            const t = now - start
            const barAttackDuration = 220 * speed
            const barPulseDuration = 2600 * speed
            const barWindDownDuration = 950 * speed
            const barSettleDuration = 1200 * speed
            const barTotalDuration =
              barAttackDuration + barPulseDuration + barWindDownDuration + barSettleDuration
            const totalDuration = Math.max(barTotalDuration, ringDrawDuration + 180 * speed)

            let energy: number
            if (t < barAttackDuration) {
              energy = easeOutCubic(t / barAttackDuration)
            } else if (t < barAttackDuration + barPulseDuration) {
              energy = 1
            } else if (t < barAttackDuration + barPulseDuration + barWindDownDuration) {
              const progress = (t - (barAttackDuration + barPulseDuration)) / barWindDownDuration
              energy = 1 - easeInOutQuad(progress)
            } else {
              energy = 0
            }

            const settleStart = barAttackDuration + barPulseDuration + barWindDownDuration * 0.35
            let settle = 0
            if (t > settleStart) {
              settle = Math.min(1, (t - settleStart) / barSettleDuration)
              settle = easeInOutQuad(settle)
            }

            barsState.forEach((state, index) => {
              const interval = 150 + (1 - energy) * 230
              if (energy > 0.01 && t > state.nextChange) {
                const range =
                  geometry.barMinHeight + energy * (geometry.barMaxHeight - geometry.barMinHeight)
                state.target =
                  geometry.barMinHeight + Math.random() * (range - geometry.barMinHeight)
                state.nextChange = t + interval + Math.random() * interval * 0.6
              }

              const stiffness = 0.045 + energy * 0.04
              const damping = 0.8
              const force = (state.target - state.current) * stiffness
              state.velocity = (state.velocity + force) * damping
              state.current += state.velocity

              const finalShape = geometry.finalBars[index]
              const voiceHeight = Math.max(geometry.barMinHeight, state.current)
              const voiceY = geometry.barCenter - voiceHeight / 2

              const h = voiceHeight * (1 - settle) + finalShape.h * settle
              const y = voiceY * (1 - settle) + finalShape.y * settle

              const bar = bars[index]
              bar.setAttribute('y', toSvg(y))
              bar.setAttribute('height', toSvg(Math.max(0, h)))
            })

            if (t < totalDuration) {
              rafId = requestAnimationFrame(tick)
              return
            }

            applyStaticState()
            if (animateOnce && animationKey) {
              playedAnimationKeys.add(animationKey)
            }
            onAnimationComplete?.()
          }
        : (now: number): void => {
            const t = now - start
            const revealStart = ringDrawDuration * 0.78
            const revealDuration = Math.max(220 * speed, ringDrawDuration * 0.2)
            const totalDuration = ringDrawDuration + 80 * speed
            const revealProgress = Math.max(0, Math.min(1, (t - revealStart) / revealDuration))
            const easedRevealProgress = easeInOutQuad(revealProgress)

            bars.forEach((bar, index) => {
              const finalShape = geometry.finalBars[index]
              bar.setAttribute('y', toSvg(finalShape.y))
              bar.setAttribute('height', toSvg(finalShape.h))
              bar.style.opacity = easedRevealProgress.toFixed(3)
            })

            if (t < totalDuration) {
              rafId = requestAnimationFrame(tick)
              return
            }

            applyStaticState()
            if (animateOnce && animationKey) {
              playedAnimationKeys.add(animationKey)
            }
            onAnimationComplete?.()
          }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [
    animate,
    animateOnce,
    animationKey,
    animationSpeed,
    barAnimation,
    geometry,
    onAnimationComplete
  ])

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      fill="none"
      className={cn('shrink-0', className)}
      aria-label="OpenVocaly logo"
      role="img"
      shapeRendering={geometry.sharpness === 'pixel-snapped' ? 'geometricPrecision' : 'auto'}
    >
      <circle
        ref={circleRef}
        cx={CIRCLE_CENTER}
        cy={CIRCLE_CENTER}
        r={geometry.circleRadius}
        stroke="currentColor"
        strokeWidth={geometry.circleStroke}
        strokeLinecap="round"
        fill="none"
      />
      {geometry.finalBars.map((shape, index) => (
        <rect
          key={index}
          data-logo-bar
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

export type {
  OpenVocalyLogoTuning,
  OpenVocalyLogoSharpness,
  OpenVocalyLogoBarPattern,
  OpenVocalyLogoBarAnimation
}
export default OpenVocalyLogo
