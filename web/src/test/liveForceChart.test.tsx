import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForceChart } from '../components/live/ForceChart.tsx'
import { NATIVE_PER_FINGER_SERIES_VISIBILITY } from '../components/live/liveSeries.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import { resetAllStores, uniformForceSample } from './testUtils.ts'

const setDataMock = vi.fn()
const setSizeMock = vi.fn()
const destroyMock = vi.fn()
const constructorOptions: unknown[] = []

let animationFrameCallback: (() => void) | null = null

vi.mock('../hooks/useAnimationFrame.ts', () => ({
  useAnimationFrame: (callback: () => void) => {
    animationFrameCallback = callback
  },
}))

vi.mock('uplot', () => ({
  default: class MockUPlot {
    constructor(options: unknown) {
      constructorOptions.push(options)
    }

    setData = setDataMock
    setSize = setSizeMock
    destroy = destroyMock
  },
}))

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

describe('ForceChart', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    resetAllStores()
    setDataMock.mockClear()
    setSizeMock.mockClear()
    destroyMock.mockClear()
    constructorOptions.length = 0
    animationFrameCallback = null

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

  it('resets chart scales when new live data arrives', async () => {
    await act(async () => {
      root.render(<ForceChart />)
    })

    useLiveStore.getState().pushSample(uniformForceSample(0, 43.7))

    await act(async () => {
      animationFrameCallback?.()
    })

    expect(setDataMock).toHaveBeenCalledTimes(1)
    expect(setDataMock.mock.calls[0]?.[1]).toBe(true)
  })

  it('can hide the total trace while keeping finger traces visible', async () => {
    await act(async () => {
      root.render(
        <ForceChart
          variant="per_finger_focus"
          seriesVisibility={NATIVE_PER_FINGER_SERIES_VISIBILITY}
        />,
      )
    })

    const options = constructorOptions[0] as {
      series: Array<{ show?: boolean }>
    }

    expect(options.series[1]?.show).toBe(false)
    expect(options.series[2]?.show).toBe(true)
    expect(options.series[3]?.show).toBe(true)
    expect(options.series[4]?.show).toBe(true)
    expect(options.series[5]?.show).toBe(true)
  })
})
