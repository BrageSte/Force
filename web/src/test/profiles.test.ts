import { describe, expect, it } from 'vitest'
import { loadActiveProfileId, loadProfiles, saveActiveProfileId, saveProfiles } from '../storage/profileStore.ts'
import { createProfile, normalizeProfileSnapshot, toProfileSnapshot } from '../types/profile.ts'

describe('profile storage and snapshots', () => {
  it('creates and persists profiles with active selection', () => {
    const first = createProfile('Alice')
    const second = createProfile('Bob')

    saveProfiles([first, second])
    saveActiveProfileId(second.profileId)

    const loaded = loadProfiles()
    expect(loaded).toHaveLength(2)
    expect(loadActiveProfileId(loaded)).toBe(second.profileId)
    expect(loaded[0].name).toBe('Alice')
    expect(loaded[1].name).toBe('Bob')
  })

  it('round-trips profile snapshots for session and test records', () => {
    const profile = createProfile('Athlete')
    profile.sex = 'Female'
    profile.weightKg = 68
    profile.heightCm = 172
    profile.injuredFingers = [false, true, false, false]
    profile.injuryNotes = 'Old middle finger pulley issue'

    const snapshot = toProfileSnapshot(profile)
    const hydrated = normalizeProfileSnapshot(snapshot)

    expect(hydrated?.profileId).toBe(profile.profileId)
    expect(hydrated?.name).toBe('Athlete')
    expect(hydrated?.injuredFingers[1]).toBe(true)
    expect(hydrated?.injuryNotes).toContain('middle finger')
  })
})
