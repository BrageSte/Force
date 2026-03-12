import { describe, expect, it } from 'vitest'
import { toProfileSnapshot, createProfile } from '../types/profile.ts'
import { getTrainProtocolById } from '../components/train/trainLibrary.ts'
import { loadTrainingSession, listTrainingSessionResults, listTrainingSessions, saveTrainingSession } from '../components/train/trainStorage.ts'
import { buildTrainSessionResult } from '../components/train/trainUtils.ts'

describe('training session storage', () => {
  it('saves indexeddb training sessions with profile metadata', async () => {
    const profile = createProfile('Athlete')
    const protocol = getTrainProtocolById('strength_10s')

    const result = buildTrainSessionResult({
      protocol,
      profile: toProfileSnapshot(profile),
      hand: 'Right',
      startedAtIso: '2026-03-11T10:00:00.000Z',
      targetMode: 'auto_from_latest_test',
      targetKg: 52,
      sourceMaxKg: 61,
      reps: [
        {
          setNo: 1,
          repNo: 1,
          plannedHangSec: 10,
          actualHangS: 9.9,
          peakTotalKg: 54,
          avgHoldKg: 51,
          impulseKgS: 480,
          adherencePct: 84,
          samples: [],
        },
      ],
      previousResult: null,
    })

    await saveTrainingSession(result)

    const meta = await listTrainingSessions()
    const all = await listTrainingSessionResults()
    const loaded = await loadTrainingSession(result.trainSessionId)

    expect(meta).toHaveLength(1)
    expect(meta[0]?.profileName).toBe('Athlete')
    expect(meta[0]?.completionPct).toBeCloseTo(100 / 9)
    expect(all[0]?.profile?.profileId).toBe(profile.profileId)
    expect(loaded?.trainSessionId).toBe(result.trainSessionId)
    expect(loaded?.summary.peakTotalKg).toBeCloseTo(54)
  })
})
