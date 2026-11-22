import type { Factor } from '@/types'
import { factorChange } from '@/lib/factorChange'
export default function FactorChange({ factor, asOf }: { factor: Factor; asOf?: string }) {
  const change = factorChange(factor, asOf)
  return <span title={change.detail}>{change.label}</span>
}
