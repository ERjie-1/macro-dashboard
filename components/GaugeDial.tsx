'use client'

import { getScoreColor } from '@/lib/mockData'

interface GaugeDialProps {
  score: number
  size?: 'sm' | 'md'
}

export default function GaugeDial({ score, size = 'md' }: GaugeDialProps) {
  const isSm = size === 'sm'
  const W = isSm ? 220 : 280
  const H = isSm ? 130 : 165
  const cx = W / 2
  const cy = isSm ? 120 : 150
  const R = isSm ? 90 : 115
  const strokeWidth = isSm ? 10 : 14

  const color = getScoreColor(score)

  // Convert score (0-100) to angle in radians
  // 0 = leftmost (180°), 100 = rightmost (0°)
  // angle from left: score/100 * π
  const scoreAngle = Math.PI - (score / 100) * Math.PI

  // Arc endpoint for filled arc
  const arcX = cx + R * Math.cos(scoreAngle)
  const arcY = cy - R * Math.sin(scoreAngle)

  // Full arc endpoints
  const startX = cx - R  // 0 score (left)
  const startY = cy
  const endX = cx + R    // 100 score (right)
  const endY = cy

  // Always use small arc (0) — filled arc never exceeds 180°
  const largeArc = 0

  // Tick marks
  const ticks = [0, 25, 50, 75, 100]
  const tickInner = R - strokeWidth / 2 - 4
  const tickOuter = R + strokeWidth / 2 + 4
  const labelR = R + strokeWidth / 2 + (isSm ? 14 : 18)

  // Needle
  const needleLength = R - strokeWidth / 2 - 8
  const needleX = cx + needleLength * Math.cos(scoreAngle)
  const needleY = cy - needleLength * Math.sin(scoreAngle)

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Background arc (gray) */}
        <path
          d={`M ${startX} ${startY} A ${R} ${R} 0 0 1 ${endX} ${endY}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />

        {/* Filled colored arc */}
        {score > 0 && (
          <path
            d={`M ${startX} ${startY} A ${R} ${R} 0 ${largeArc} 1 ${arcX} ${arcY}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        )}

        {/* Tick marks & labels */}
        {ticks.map((tick) => {
          const a = Math.PI - (tick / 100) * Math.PI
          const ix = cx + tickInner * Math.cos(a)
          const iy = cy - tickInner * Math.sin(a)
          const ox = cx + tickOuter * Math.cos(a)
          const oy = cy - tickOuter * Math.sin(a)
          const lx = cx + labelR * Math.cos(a)
          const ly = cy - labelR * Math.sin(a)
          return (
            <g key={tick}>
              <line x1={ix} y1={iy} x2={ox} y2={oy} stroke="#9ca3af" strokeWidth={1.5} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isSm ? 9 : 11}
                fill="#9ca3af"
              >
                {tick}
              </text>
            </g>
          )
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#374151"
          strokeWidth={isSm ? 1.5 : 2}
          strokeLinecap="round"
        />
        {/* Needle base dot */}
        <circle cx={cx} cy={cy} r={isSm ? 4 : 5} fill="#374151" />
      </svg>
    </div>
  )
}
