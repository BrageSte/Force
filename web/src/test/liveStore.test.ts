import { describe, expect, it } from 'vitest'
import { useLiveStore } from '../stores/liveStore.ts'
import { resetAllStores } from './testUtils.ts'

describe('live store', () => {
  it('allocates ring buffer capacity for the 80 Hz CURRENT_UNO_HX711 stream', () => {
    resetAllStores({ ringBufferSeconds: 50 })

    expect(useLiveStore.getState().capacity).toBe(4000)

    useLiveStore.getState().setBufferSeconds(15)
    expect(useLiveStore.getState().capacity).toBe(1200)
  })
})
