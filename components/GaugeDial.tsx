'use client'

import { useId } from 'react'

interface GaugeDialProps {
  score: number
  size?: 'sm' | 'md'
}

function getNeedleColor(score: number): string {
  if (score < 35) return '#dc2626'
  if (score < 50) return '#ca8a04'
  if (score < 65) return '#84cc16'
  return '#16a34a'
}

export default function GaugeDial({ score, size = 'md' }: GaugeDialProps) {
  const gradId = useId().replace(/:/g, '')
  const isSm = size === 'sm'
  const clamped = Math.max(0, Math.min(100, score))

  // Generous viewBox padding so 0 and 100 labels are never clipped
  const W = isSm ? 260 : 320
  const H = isSm ? 148 : 178
  const cx = W / 2
  const cy = isSm ? 132 : 158
  const R = isSm ? 86 : 108
  const strokeWidth = isSm ? 6 : 7.5

  const scoreAngle = Math.PI - (clamped / 100) * Math.PI
  const arcX = cx + R * Math.cos(scoreAngle)
  const arcY = cy - R * Math.sin(scoreAngle)

  const startX = cx - R
  const startY = cy
  const endX = cx + R
  const endY = cy

  // Major & minor inner tick marks (matching MacroDial)
  const majorTicks = [0, 25, 50, 75, 100]
  const minorTicks = [12.5, 37.5, 62.5, 87.5]

  const majorInner = R - strokeWidth / 2 - (isSm ? 9 : 11)
  const majorOuter = R - strokeWidth / 2 - 2
  const minorInner = R - strokeWidth / 2 - (isSm ? 5.5 : 7)
  const minorOuter = R - strokeWidth / 2 - 2
  const labelR = R + strokeWidth / 2 + (isSm ? 14 : 17)

  // Fine tapered needle
  const needleLength = R - strokeWidth / 2 - (isSm ? 10 : 13)
  const needleX = cx + needleLength * Math.cos(scoreAngle)
  const needleY = cy - needleLength * Math.sin(scoreAngle)
  const needleColor = getNeedleColor(clamped)

  return (
    <div className="flex flex-col items-center w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={isSm ? 'w-full max-w-[250px] h-auto overflow-visible' : 'w-full max-w-[300px] h-auto overflow-visible'}
        role="img"
        aria-label={`Macro-Economic Conditions Score ${clamped.toFixed(1)} out of 100`}
      >
        <defs>
          <linearGradient
            id={`gauge-grad-${gradId}`}
            gradientUnits="userSpaceOnUse"
            x1={startX}
            y1={cy}
            x2={endX}
            y2={cy}
          >
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="35%" stopColor="#ea580c" />
            <stop offset="62%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient
            id={`needle-grad-${gradId}`}
            gradientUnits="userSpaceOnUse"
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
          >
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="35%" stopColor={needleColor} />
            <stop offset="100%" stopColor={needleColor} />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d={`M ${startX} ${startY} A ${R} ${R} 0 0 1 ${endX} ${endY}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Filled gradient arc */}
        {clamped > 0 && (
          <path
            d={`M ${startX} ${startY} A ${R} ${R} 0 0 1 ${arcX} ${arcY}`}
            fill="none"
            stroke={`url(#gauge-grad-${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Minor inner ticks */}
        {minorTicks.map((tick) => {
          const a = Math.PI - (tick / 100) * Math.PI
          return (
            <line
              key={tick}
              x1={cx + minorInner * Math.cos(a)}
              y1={cy - minorInner * Math.sin(a)}
              x2={cx + minorOuter * Math.cos(a)}
              y2={cy - minorOuter * Math.sin(a)}
              stroke="#d1d5db"
              strokeWidth={1}
            />
          )
        })}

        {/* Major inner ticks & outer labels */}
        {majorTicks.map((tick) => {
          const a = Math.PI - (tick / 100) * Math.PI
          const ix = cx + majorInner * Math.cos(a)
          const iy = cy - majorInner * Math.sin(a)
          const ox = cx + majorOuter * Math.cos(a)
          const oy = cy - majorOuter * Math.sin(a)
          const lx = cx + labelR * Math.cos(a)
          const ly = cy - labelR * Math.sin(a)
          const anchor = tick === 0 ? 'end' : tick === 100 ? 'start' : 'middle'
          const xOffset = tick === 0 ? 4 : tick === 100 ? -4 : 0

          return (
            <g key={tick}>
              <line x1={ix} y1={iy} x2={ox} y2={oy} stroke="#9ca3af" strokeWidth={1.25} />
              <text
                x={lx + xOffset}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={isSm ? 9.5 : 10.5}
                fontFamily="var(--font-mono), monospace"
                fill="#6b7280"
              >
                {tick}
              </text>
            </g>
          )
        })}

        {/* Fine gradient needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={`url(#needle-grad-${gradId})`}
          strokeWidth={isSm ? 1.8 : 2.1}
          strokeLinecap="round"
        />

        {/* Needle center hub */}
        <circle cx={cx} cy={cy} r={isSm ? 4 : 4.8} fill="#1f2937" />
      </svg>
    </div>
  )
}
