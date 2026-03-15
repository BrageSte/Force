import { describe, expect, it } from 'vitest'
import { saveCurrentRecordingAsSession } from '../live/sessionWorkflow.ts'
import { useAppStore } from '../stores/appStore.ts'
import { useLiveStore } from '../stores/liveStore.ts'
import { resetAllStores, uniformForceSample } from './testUtils.ts'

describe('session workflow integration', () => {
  it('saves a recording and reloads it from indexeddb', async () => {
    resetAllStores()

    const live = useLiveStore.getState()
    live.startRecording('Right')

    for (const [index, totalKg] of [0, 1, 1, 1, 1, 1, 0.1, 0.1, 0.1, 0.1].entries()) {
      live.appendRecordedSample(uniformForceSample(index * 100, totalKg))
    }

    const payload = await saveCurrentRecordingAsSession()

    expect(payload).not.toBeNull()
    expect(payload?.profile?.name).toBe('Test Person')
    expect(payload?.summary.effortsCount).toBeGreaterThanOrEqual(1)
    expect(useAppStore.getState().sessions).toHaveLength(1)
    expect(useAppStore.getState().sessions[0]?.profileName).toBe('Test Person')

    const loaded = await useAppStore.getState().loadSession(payload!.sessionId)
    expect(loaded?.sessionId).toBe(payload?.sessionId)
    expect(loaded?.profile?.profileId).toBe(payload?.profile?.profileId)
    expect(loaded?.samples).toHaveLength(10)
  })

  it('uses the recording hand when saving the session payload', async () => {
    resetAllStores()

    const live = useLiveStore.getState()
    live.startRecording('Left')
    useAppStore.getState().setHand('Right')

    for (const [index, totalKg] of [0, 1, 1, 1, 1, 1, 0.1, 0.1, 0.1, 0.1].entries()) {
      live.appendRecordedSample(uniformForceSample(index * 100, totalKg))
    }

    const payload = await saveCurrentRecordingAsSession()

    expect(payload?.hand).toBe('Left')
    expect(payload?.summary.hand).toBe('Left')
  })
})
