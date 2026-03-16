import { describe, expect, it } from 'vitest'
import { saveSession, loadSession, listSessions } from '../storage/sessionStore.ts'
import { getDB } from '../storage/db.ts'
import type { SessionPayload } from '../types/force.ts'
import { defaultConnectedDevice } from '../device/deviceProfiles.ts'

type LegacySessionPayload =
  Omit<SessionPayload, 'deviceType' | 'deviceName' | 'capabilities' | 'sampleSource' | 'protocolVersion'>
  & Partial<Pick<SessionPayload, 'deviceType' | 'deviceName' | 'capabilities' | 'sampleSource' | 'protocolVersion'>>

function makeSession(sessionId: string, overrides: Partial<SessionPayload> = {}): SessionPayload {
  const device = defaultConnectedDevice('Tindeq')
  return {
    sessionId,
    startedAtIso: '2026-03-16T10:00:00.000Z',
    endedAtIso: '2026-03-16T10:05:00.000Z',
    hand: 'Right',
    deviceType: device.deviceType,
    deviceName: device.deviceName,
    capabilities: device.capabilities,
    sampleSource: device.sourceKind,
    protocolVersion: 1,
    profile: null,
    tag: '',
    notes: '',
    summary: {
      sessionId,
      startedAtIso: '2026-03-16T10:00:00.000Z',
      endedAtIso: '2026-03-16T10:05:00.000Z',
      hand: 'Right',
      effortsCount: 1,
      bestPeakKg: 42,
      avgPeakKg: 42,
      fatigueSlopeKgPerEffort: 0,
      firstToLastDropPct: 0,
    },
    efforts: [],
    samples: [],
    ...overrides,
  }
}

describe('session persistence for tindeq', () => {
  it('persists and lists tindeq metadata', async () => {
    const sessionId = `tindeq_${Date.now()}`
    await saveSession(makeSession(sessionId))

    const loaded = await loadSession(sessionId)
    const listed = await listSessions()

    expect(loaded?.deviceType).toBe('tindeq')
    expect(loaded?.capabilities.perFingerForce).toBe(false)
    expect(listed.find(item => item.sessionId === sessionId)?.deviceType).toBe('tindeq')
  })

  it('hydrates legacy sessions without device metadata as native sessions', async () => {
    const sessionId = `legacy_${Date.now()}`
    const db = await getDB()
    const legacySession = {
      sessionId,
      startedAtIso: '2026-03-16T09:00:00.000Z',
      endedAtIso: '2026-03-16T09:05:00.000Z',
      hand: 'Left',
      tag: '',
      notes: '',
      summary: {
        sessionId,
        startedAtIso: '2026-03-16T09:00:00.000Z',
        endedAtIso: '2026-03-16T09:05:00.000Z',
        hand: 'Left',
        effortsCount: 0,
        bestPeakKg: 0,
        avgPeakKg: 0,
        fatigueSlopeKgPerEffort: 0,
        firstToLastDropPct: 0,
      },
      efforts: [],
      samples: [],
    } satisfies LegacySessionPayload
    await db.put('sessions', legacySession as unknown as SessionPayload)

    const loaded = await loadSession(sessionId)

    expect(loaded?.deviceType).toBe('native-bs')
    expect(loaded?.capabilities.perFingerForce).toBe(true)
  })
})
