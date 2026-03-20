import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVerificationSnapshot } from '@krimblokk/core'
import type { ForceSample } from '../types/force.ts'
import { LivePage } from '../components/live/LivePage.tsx'
import { useAppStore } from '../stores/appStore.ts'
import { useDeviceStore } from '../stores/deviceStore.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import { useVerificationStore } from '../stores/verificationStore.ts'
import { resetAllStores } from './testUtils.ts'

vi.mock('../hooks/useAnimationFrame.ts', () => ({
  useAnimationFrame: () => undefined,
}))

vi.mock('uplot', () => ({
  default: class MockUPlot {
    constructor() {}

    setData() {}
    setSize() {}
    destroy() {}
  },
}))

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find(node => node.textContent?.includes(label))
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`)
  }
  return button
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

describe('LivePage', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    resetAllStores()

    Object.defineProperty(globalThis, 'ResizeObserver', {
      value: MockResizeObserver,
      configurable: true,
    })

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

  it('shows a prominent connect CTA in the disconnected state', async () => {
    await act(async () => {
      root.render(<LivePage />)
    })

    expect(buttonByText(container, 'Connect device')).toBeInstanceOf(HTMLButtonElement)
    expect(container.textContent).toContain('Start here:')
    expect(container.textContent).toContain('Device disconnected')
    expect(container.textContent).toContain('Setup checklist')
    expect(container.textContent).toContain('Run your first core benchmark')
  })

  it('routes checklist actions toward the requested setup surface', async () => {
    const onNavigate = vi.fn()

    await act(async () => {
      root.render(<LivePage onNavigate={onNavigate} />)
    })

    await act(async () => {
      buttonByText(container, 'Open PROFILE').click()
    })

    expect(onNavigate).toHaveBeenCalledWith('profile')
  })

  it('keeps the quick mode UI to one active detail surface', async () => {
    await act(async () => {
      root.render(<LivePage />)
    })

    expect(container.querySelectorAll('section[aria-label="Quick mode detail"]')).toHaveLength(1)
    expect(container.textContent).toContain('Continuous live view for quick checks without storing a local capture.')

    await act(async () => {
      buttonByText(container, 'Peak Per Finger').click()
    })

    expect(container.querySelectorAll('section[aria-label="Quick mode detail"]')).toHaveLength(1)
    expect(container.textContent).toContain('Capture one pull and break the peak out per finger at the top of the effort.')
    expect(container.textContent).not.toContain('Continuous live view for quick checks without storing a local capture.')
  })

  it('updates the finger card order between right and left hand display modes', async () => {
    await act(async () => {
      root.render(<LivePage />)
    })

    const fingerNames = () => Array.from(container.querySelectorAll('[data-finger-card] h3'))
      .map(node => node.textContent)

    expect(fingerNames()).toEqual(['Index', 'Middle', 'Ring', 'Pinky'])

    await act(async () => {
      useAppStore.getState().setHand('Left')
    })

    expect(fingerNames()).toEqual(['Pinky', 'Ring', 'Middle', 'Index'])
  })

  it('collapses into a total-force fallback for total-force-only devices', async () => {
    resetAllStores({ preferredSource: 'Tindeq' })
    useDeviceStore.setState({
      sourceKind: 'Tindeq',
      connected: true,
      connectionState: 'connected',
    })

    await act(async () => {
      root.render(<LivePage />)
    })

    expect(container.textContent).toContain('CURRENT_UNO_HX711')
    expect(container.textContent).toContain('Total Force Live')
    expect(container.querySelectorAll('[data-finger-card]')).toHaveLength(0)
  })

  it('shows a blocked verification state and hides live values', async () => {
    useDeviceStore.setState({
      sourceKind: 'Serial',
      connected: true,
      connectionState: 'connected',
    })
    useVerificationStore.setState({
      snapshot: createVerificationSnapshot('critical', [], 'Waiting for firmware to confirm KG mode.'),
      blockReason: 'Waiting for firmware to confirm KG mode.',
    })

    await act(async () => {
      root.render(<LivePage />)
    })

    expect(container.textContent).toContain('Blocked')
    expect(container.textContent).toContain('Waiting for firmware to confirm KG mode.')
    expect(container.textContent).toContain('Live force values are hidden until the stream is verified again.')
    expect(container.querySelectorAll('[data-finger-card]')).toHaveLength(0)
    expect(buttonByText(container, 'Record Session').disabled).toBe(true)
  })

  it('shows pull-only mini trends and clears them after reset', async () => {
    useLiveStore.setState({
      currentEffortSamples: [
        fingerSample(0, [0.5, 1, 0.8, 0.4]),
        fingerSample(100, [1.1, 1.8, 1.4, 0.7]),
        fingerSample(200, [0.7, 1.2, 0.9, 0.5]),
      ],
      quickResult: {
        presetId: 'peak_per_finger',
        label: 'Peak Per Finger',
        completionReason: 'effort_complete',
        capturedAtIso: new Date().toISOString(),
        startedAtMs: 0,
        durationS: 0.2,
        sampleCount: 3,
        peakTotalKg: 4.4,
        peakPerFingerKg: [1.1, 1.8, 1.4, 0.7],
        peakSharePct: [25, 41, 32, 16],
        timeToPeakS: 0.1,
        rfd100KgS: 10,
        rfd200KgS: 20,
        avgHoldKg: 2.4,
        totalForceDriftKgS: 0,
        contributionDriftPct: null,
        distributionDriftPerS: null,
        steadinessTotalKg: 0.1,
        perFingerVariationKg: null,
        stabilizationTimeS: null,
        analysis: {
          effortId: 1,
          startTMs: 0,
          endTMs: 200,
          durationS: 0.2,
          peakTotalKg: 4.4,
          peakPerFingerKg: [1.1, 1.8, 1.4, 0.7],
          timeToPeakS: 0.1,
          rfd100KgS: 10,
          rfd200KgS: 20,
          rfd100NS: 98,
          rfd200NS: 196,
          avgTotalKg: 2.4,
          tutS: 0.2,
          distributionDriftPerS: null,
          steadinessTotalKg: 0.1,
          steadinessPerFingerKg: null,
          fingerImbalanceIndex: null,
          loadVariationCv: null,
          dominantSwitchCount: null,
          loadShiftRate: null,
          stabilizationTimeS: null,
          ringPinkyShare: null,
          holdStartTMs: 0,
          holdEndTMs: 200,
          detailTMs: [0, 100, 200],
          detailTotalKg: [2.7, 5, 3.3],
          detailFingerKg: [
            [0.5, 1, 0.8, 0.4],
            [1.1, 1.8, 1.4, 0.7],
            [0.7, 1.2, 0.9, 0.5],
          ],
          detailFingerPct: null,
        },
      },
    })

    await act(async () => {
      root.render(<LivePage />)
    })

    expect(container.textContent).toContain('3 pts')

    await act(async () => {
      buttonByText(container, 'Reset LIVE').click()
    })

    expect(useLiveStore.getState().currentEffortSamples).toHaveLength(0)
    expect(useLiveStore.getState().quickResult).toBeNull()
    expect(useLiveStore.getState().lastEffort).toBeNull()
    expect(container.textContent).toContain('No data')
  })
})
