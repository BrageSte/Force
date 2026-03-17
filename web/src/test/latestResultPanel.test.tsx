import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ForceSample } from '../types/force.ts'
import { LatestResultPanel } from '../components/live/LatestResultPanel.tsx'
import { buildQuickMeasureResult } from '../live/quickMeasure.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import { resetAllStores } from './testUtils.ts'

const ANALYSIS_CONFIG = {
  tutThresholdKg: 0.5,
  holdPeakFraction: 0.9,
  stabilizationShiftThreshold: 0.8,
  stabilizationHoldMs: 250,
}

function fingerSample(tMs: number, values: [number, number, number, number]): ForceSample {
  const totalKg = values[0] + values[1] + values[2] + values[3]
  return {
    tMs,
    source: 'native-bs',
    raw: values,
    kg: values,
    totalKg,
    totalN: totalKg * 9.80665,
    stability: null,
  }
}

describe('LatestResultPanel', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    resetAllStores()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('prioritizes the matching quick result over last effort metrics', async () => {
    const result = buildQuickMeasureResult({
      presetId: 'peak_total_pull',
      completionReason: 'effort_complete',
      analysisConfig: ANALYSIS_CONFIG,
      samples: [
        fingerSample(0, [0, 0, 0, 0]),
        fingerSample(100, [1.5, 1.5, 1.5, 1.5]),
        fingerSample(200, [2.5, 2.5, 2.5, 2.5]),
        fingerSample(300, [0.5, 0.5, 0.5, 0.5]),
      ],
    })

    if (!result) {
      throw new Error('Expected a quick result for test setup')
    }

    useLiveStore.setState({
      quickMeasurePresetId: 'peak_total_pull',
      quickResult: result,
      lastEffort: {
        ...result.analysis,
        peakTotalKg: result.peakTotalKg + 8,
      },
    })

    await act(async () => {
      root.render(<LatestResultPanel />)
    })

    expect(container.textContent).toContain('Peak Total Pull')
    expect(container.textContent).toContain(`${result.peakTotalKg.toFixed(1)}`)
    expect(container.textContent).not.toContain('Last Effort')
    expect(container.textContent).not.toContain(`${(result.peakTotalKg + 8).toFixed(1)}`)
  })

  it('falls back to the latest effort when the stored quick result belongs to another preset', async () => {
    const result = buildQuickMeasureResult({
      presetId: 'peak_total_pull',
      completionReason: 'effort_complete',
      analysisConfig: ANALYSIS_CONFIG,
      samples: [
        fingerSample(0, [0, 0, 0, 0]),
        fingerSample(100, [1.2, 1.2, 1.2, 1.2]),
        fingerSample(200, [2, 2, 2, 2]),
        fingerSample(300, [0.2, 0.2, 0.2, 0.2]),
      ],
    })

    if (!result) {
      throw new Error('Expected a quick result for test setup')
    }

    useLiveStore.setState({
      quickMeasurePresetId: 'live_monitor',
      quickResult: result,
      lastEffort: {
        ...result.analysis,
        peakTotalKg: 19.4,
      },
    })

    await act(async () => {
      root.render(<LatestResultPanel />)
    })

    expect(container.textContent).toContain('Last Effort')
    expect(container.textContent).toContain('19.4')
    expect(container.textContent).not.toContain('Peak Total Pull')
  })

  it('expands peak-per-finger captures with finger peaks and share at peak', async () => {
    const result = buildQuickMeasureResult({
      presetId: 'peak_per_finger',
      completionReason: 'effort_complete',
      analysisConfig: ANALYSIS_CONFIG,
      samples: [
        fingerSample(0, [0, 0, 0, 0]),
        fingerSample(100, [2.2, 3.1, 2.4, 1.5]),
        fingerSample(200, [2.8, 3.6, 2.9, 1.8]),
        fingerSample(300, [0.3, 0.3, 0.3, 0.3]),
      ],
    })

    if (!result) {
      throw new Error('Expected a quick result for test setup')
    }

    useLiveStore.setState({
      quickMeasurePresetId: 'peak_per_finger',
      quickResult: result,
    })

    await act(async () => {
      root.render(<LatestResultPanel />)
    })

    expect(container.textContent).toContain('Per Finger Peaks')
    expect(container.textContent).toContain('Capture time')
    expect(container.textContent).toContain('share at peak')
  })
})
