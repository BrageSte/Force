import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVerificationSnapshot } from '@krimblokk/core'
import { GuidedTestScreen } from '../components/test/GuidedTestScreen.tsx'
import { getProtocolById } from '../components/test/testLibrary.ts'
import { GuidedTrainScreen } from '../components/train/GuidedTrainScreen.tsx'
import { getTrainProtocolById } from '../components/train/trainLibrary.ts'
import { createDefaultSimulatorAthleteProfile } from '../device/simulatorAthlete.ts'
import { useDeviceStore } from '../stores/deviceStore.ts'
import { useVerificationStore } from '../stores/verificationStore.ts'
import { resetAllStores } from './testUtils.ts'
import type { DeviceProvider, DeviceScanResult } from '../types/device.ts'
import type { ConnectedDeviceInfo } from '../types/force.ts'
import type { RestoreSimulatorArgs, SimulatorRuntimeState } from '../device/simulatorTypes.ts'

vi.mock('../hooks/useAnimationFrame.ts', () => ({
  useAnimationFrame: () => undefined,
}))

vi.mock('../components/test/guided/audioCues.ts', () => ({
  useAudioCuePlayer: () => ({
    ensureAudioContext: async () => undefined,
    playCountdownBeep: () => undefined,
    playGoCue: () => undefined,
    playStopCue: () => undefined,
  }),
}))

class FakeSimulatorProvider implements DeviceProvider {
  readonly displayName = 'Simulator'
  readonly sourceKind = 'Simulator'

  onForceData = null
  onConnectionStateChange = null
  onStatus = null
  onError = null

  states: SimulatorRuntimeState[] = []
  restores: RestoreSimulatorArgs[] = []

  async scanDevices(): Promise<DeviceScanResult[]> {
    return []
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async tare(): Promise<void> {}
  async startStreaming(): Promise<void> {}
  async stopStreaming(): Promise<void> {}
  async getBatteryStatus(): Promise<number | null> {
    return null
  }

  async setSimulatorState(state: SimulatorRuntimeState): Promise<void> {
    this.states.push(state)
  }

  async restoreDefaultSimulatorState(args?: RestoreSimulatorArgs): Promise<void> {
    this.restores.push(args ?? {})
  }

  isConnected(): boolean {
    return true
  }

  getConnectedDevice(): ConnectedDeviceInfo | null {
    return null
  }
}

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find(node => node.textContent?.includes(label))
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`)
  }
  return button
}

function inputByAriaLabel(container: HTMLElement, label: string): HTMLInputElement {
  const input = container.querySelector(`input[aria-label="${label}"]`)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Input not found: ${label}`)
  }
  return input
}

describe('guided simulator screen control', () => {
  let container: HTMLDivElement
  let root: Root
  let mounted = false

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mounted = true
  })

  afterEach(async () => {
    if (mounted) {
      await act(async () => {
        root.unmount()
      })
    }
    container.remove()
    vi.useRealTimers()
  })

  it('pushes test simulator state through countdown, work, and cleanup', async () => {
    resetAllStores({ preferredSource: 'Simulator' })
    const provider = new FakeSimulatorProvider()
    useDeviceStore.setState({
      sourceKind: 'Simulator',
      provider,
      connected: true,
      connectionState: 'connected',
    })

    const athlete = createDefaultSimulatorAthleteProfile({ referenceMaxKg: 40 })

    await act(async () => {
      root.render(
        <GuidedTestScreen
          protocol={getProtocolById('standard_max')}
          hand="Right"
          targetKg={null}
          oppositeHandBestPeakKg={null}
          alternateHands={false}
          profile={null}
          simulatorProfiles={{ Left: athlete, Right: athlete }}
          onComplete={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    expect(provider.states.at(-1)?.phase).toBe('idle')

    await act(async () => {
      buttonByText(container, 'Start Right Attempt').click()
    })

    expect(provider.states.at(-1)?.phase).toBe('countdown')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    const workState = provider.states.at(-1)
    expect(workState?.phase).toBe('work')
    expect(workState?.pattern).toBe('max_pull')
    expect(workState?.targetKg).toBeCloseTo(31.2, 4)

    await act(async () => {
      root.unmount()
    })
    mounted = false

    expect(provider.restores.at(-1)?.hand).toBe('Right')
  })

  it('shows finger traces by default and lets total be added from the sidebar', async () => {
    resetAllStores({ preferredSource: 'Simulator' })
    const provider = new FakeSimulatorProvider()
    useDeviceStore.setState({
      sourceKind: 'Simulator',
      provider,
      connected: true,
      connectionState: 'connected',
    })

    const athlete = createDefaultSimulatorAthleteProfile({ referenceMaxKg: 40 })

    await act(async () => {
      root.render(
        <GuidedTestScreen
          protocol={getProtocolById('standard_max')}
          hand="Right"
          targetKg={null}
          oppositeHandBestPeakKg={null}
          alternateHands={false}
          profile={null}
          simulatorProfiles={{ Left: athlete, Right: athlete }}
          onComplete={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    const totalToggle = inputByAriaLabel(container, 'Include total trace')
    expect(totalToggle.checked).toBe(false)

    const chart = container.querySelector('svg[aria-label="Live trace chart"]')
    expect(chart?.querySelectorAll('polyline')).toHaveLength(4)

    await act(async () => {
      totalToggle.click()
    })

    expect(totalToggle.checked).toBe(true)
    expect(chart?.querySelectorAll('polyline')).toHaveLength(5)
  })

  it('pushes train simulator state for countdown, warmup work, rest, and cleanup', async () => {
    resetAllStores({ preferredSource: 'Simulator' })
    const provider = new FakeSimulatorProvider()
    useDeviceStore.setState({
      sourceKind: 'Simulator',
      provider,
      connected: true,
      connectionState: 'connected',
    })

    const athlete = createDefaultSimulatorAthleteProfile({ referenceMaxKg: 38 })
    const protocol = getTrainProtocolById('strength_10s')

    await act(async () => {
      root.render(
        <GuidedTrainScreen
          protocol={protocol}
          hand="Right"
          profile={null}
          targetMode="auto_from_latest_test"
          targetKg={20}
          sourceMaxKg={38}
          bodyweightRelativeTarget={null}
          benchmarkReference={null}
          simulatorProfiles={{ Left: athlete, Right: athlete }}
          previousResult={null}
          recommendation={null}
          latestBenchmark={null}
          onComplete={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    expect(provider.states.at(-1)?.phase).toBe('idle')

    await act(async () => {
      buttonByText(container, 'Start Workout').click()
    })

    expect(provider.states.at(-1)?.phase).toBe('countdown')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    const warmupState = provider.states.at(-1)
    expect(warmupState?.phase).toBe('work')
    expect(warmupState?.detailLabel).toContain('Warm-up Primer')
    expect(warmupState?.targetKg).toBe(12)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000)
    })

    const restState = provider.states.at(-1)
    expect(restState?.phase).toBe('rest')
    expect(restState?.targetKg).toBeNull()

    await act(async () => {
      root.unmount()
    })
    mounted = false

    expect(provider.restores.at(-1)?.hand).toBe('Right')
  })

  it('shows an abort message when runtime verification fails mid-test', async () => {
    resetAllStores({ preferredSource: 'Simulator' })
    const provider = new FakeSimulatorProvider()
    useDeviceStore.setState({
      sourceKind: 'Simulator',
      provider,
      connected: true,
      connectionState: 'connected',
    })

    const athlete = createDefaultSimulatorAthleteProfile({ referenceMaxKg: 40 })

    await act(async () => {
      root.render(
        <GuidedTestScreen
          protocol={getProtocolById('standard_max')}
          hand="Right"
          targetKg={null}
          oppositeHandBestPeakKg={null}
          alternateHands={false}
          profile={null}
          simulatorProfiles={{ Left: athlete, Right: athlete }}
          onComplete={() => undefined}
          onCancel={() => undefined}
        />,
      )
    })

    await act(async () => {
      buttonByText(container, 'Start Right Attempt').click()
      await vi.advanceTimersByTimeAsync(3_000)
    })

    await act(async () => {
      useVerificationStore.setState({
        snapshot: createVerificationSnapshot('critical', [], 'The stream looks like raw counts while KG mode is active.'),
        blockReason: 'The stream looks like raw counts while KG mode is active.',
      })
    })

    expect(container.textContent).toContain('aborted before any result could be saved')
    expect(container.textContent).toContain('raw counts while KG mode is active')
  })
})
