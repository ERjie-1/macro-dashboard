import fs from 'fs'
import path from 'path'
import type { MacroDashboard, Module } from '@/types'
import type { PositioningDashboard } from '@/types/positioning'

const filePath = path.join(process.cwd(), 'public/data/dashboard.json')
export const dashboardData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MacroDashboard

const positioningPath = path.join(process.cwd(), 'public/data/positioning.json')

export function getPositioningData(): PositioningDashboard | null {
  try {
    const raw = fs.readFileSync(positioningPath, 'utf-8')
    const data = JSON.parse(raw) as PositioningDashboard
    if (data.updatedAt === null) return null
    return data
  } catch {
    return null
  }
}

export function getModuleBySlug(slug: string): Module | undefined {
  return dashboardData.modules.find((m) => m.slug === slug)
}

export function getScoreColor(score: number): string {
  if (score < 40) return '#e63333'   // hsl(0, 80%, 55%)
  if (score < 60) return '#f5a406'   // hsl(38, 92%, 50%)
  return '#1e9e3f'                   // hsl(142, 72%, 42%)
}

export function getStatusColor(status: string): string {
  if (status === 'supportive') return '#22c55e'
  if (status === 'neutral') return '#f97316'
  return '#ef4444'
}
