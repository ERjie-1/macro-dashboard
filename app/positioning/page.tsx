import { getPositioningData } from '@/lib/getData'
import RelativeTime from '@/components/RelativeTime'
import VixCurve from '@/components/VixCurve'
import OptionsSection from '@/components/OptionsSection'
import CotSection from '@/components/CotSection'
import EtfFlowGrid from '@/components/EtfFlowGrid'

export default function PositioningPage() {
  const data = getPositioningData()

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Positioning & Flow</h1>
          <p className="text-gray-500">Data not yet available. Run the positioning pipeline to generate data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Positioning & Flow</h1>
          {data.updatedAt && (
            <span className="text-sm text-gray-500">
              Updated <RelativeTime isoString={data.updatedAt} />
            </span>
          )}
        </div>

        {/* VIX Term Structure + SKEW */}
        <VixCurve
          vixData={data.vixTermStructure}
          skewData={data.skewIndex}
        />

        {/* Options Structure */}
        <OptionsSection options={data.options} />

        {/* CFTC Positioning */}
        <CotSection cot={data.cot} />

        {/* ETF Fund Flows */}
        <EtfFlowGrid flows={data.etfFlows} />
      </div>
    </div>
  )
}
