import type { MacroDashboard, Module } from '@/types'
import dashboardJson from '@/public/data/dashboard.json'

export const dashboardData = dashboardJson as unknown as MacroDashboard

export function getModuleBySlug(slug: string): Module | undefined {
  return dashboardData.modules.find((m) => m.slug === slug)
}

export function getScoreColor(score: number): string {
  if (score < 33) return '#ef4444'
  if (score < 66) return '#f97316'
  return '#14b8a6'
}

export function getStatusColor(status: string): string {
  if (status === 'supportive') return '#22c55e'
  if (status === 'neutral') return '#f97316'
  return '#ef4444'
}
