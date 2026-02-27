'use client'

import { useEffect, useState } from 'react'

function computeTimeAgo(isoString: string): string {
  const now = new Date()
  const then = new Date(isoString)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 2) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export default function RelativeTime({ isoString }: { isoString: string }) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    setLabel(computeTimeAgo(isoString))
    const timer = setInterval(() => setLabel(computeTimeAgo(isoString)), 60_000)
    return () => clearInterval(timer)
  }, [isoString])

  // Server render: show nothing (avoids hydration mismatch); client fills in
  if (!label) return null
  return <span>{label}</span>
}
