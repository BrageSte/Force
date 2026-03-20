import { describe, expect, it } from 'vitest'
import type { CompletedTestResult } from '../components/test/types.ts'
import { getProtocolById } from '../components/test/testLibrary.ts'
import { deriveSetupReadiness } from '../setup/setupReadiness.ts'
import { createProfile, toProfileSnapshot } from '../types/profile.ts'

function baseProfile() {
  const profile = createProfile('Athlete')
  profile.weightKg = 72
  return profile
}

function standardMaxResult(profileId: string): CompletedTestResult {
  const profile = baseProfile()
  profile.profileId = profileId

  return {
    resultId: 'result_standard_max',
    protocolKind: 'builtin',
    protocolId: 'standard_max',
    protocolName: 'Max Strength Benchmark',
    builtInId: 'standard_max',
    tier: 'Core',
    hand: 'Right',
    startedAtIso: '2026-03-20T09:58:00.000Z',
    completedAtIso: '2026-03-20T10:00:00.000Z',
    profile: toProfileSnapshot(profile),
    targetKg: null,
    effectiveProtocol: getProtocolById('standard_max'),
    dashboardSnapshot: {
      livePanels: ['timer'],
      resultWidgets: ['summary'],
    },
    compareTags: {
      family: 'max_pull',
      targetMode: 'none',
      intervalMode: 'continuous',
    },
    attempts: [],
    summary: {
      bestAttemptNo: 1,
      strongestFinger: 0,
      weakestContributor: 3,
      biggestFadeFinger: 3,
      takeoverFinger: 1,
      mostStableFinger: 1,
      repeatabilityScore: 95,
      leftRightAsymmetryPct: null,
      sessionTrendPct: 0,
      benchmarkScore: null,
      safetyFlags: [],
    },
    confidence: {
      core: 'High',
      coaching: 'Moderate',
      experimental: 'Low',
    },
  }
}

describe('deriveSetupReadiness', () => {
  it('flags missing profile basics and missing first benchmark for a new disconnected user', () => {
    const profile = createProfile('Person 1')

    const report = deriveSetupReadiness({
      profile,
      testResults: [],
      connected: false,
      deviceCapabilities: {
        totalForce: true,
        perFingerForce: true,
        batteryStatus: false,
        tare: true,
        startStopStreaming: true,
      },
      inputMode: 'MODE_KG_DIRECT',
      sourceKind: 'Serial',
      verificationStatus: 'checking',
      verificationReason: null,
      tareRequired: false,
      calibrationScales: [0.1, 0.1, 0.1, 0.1],
    })

    expect(report.ready).toBe(false)
    expect(report.states).toContain('device_disconnected')
    expect(report.states).toContain('profile_basics_missing')
    expect(report.states).toContain('first_benchmark_missing')
  })

  it('treats verification checking as an active setup state while connected', () => {
    const report = deriveSetupReadiness({
      profile: baseProfile(),
      testResults: [],
      connected: true,
      deviceCapabilities: {
        totalForce: true,
        perFingerForce: true,
        batteryStatus: false,
        tare: true,
        startStopStreaming: true,
      },
      inputMode: 'MODE_KG_DIRECT',
      sourceKind: 'Serial',
      verificationStatus: 'checking',
      verificationReason: 'Waiting for firmware to confirm KG mode.',
      tareRequired: false,
      calibrationScales: [0.1, 0.1, 0.1, 0.1],
    })

    expect(report.primaryState).toBe('verification_checking')
    expect(report.items[0]?.summary).toContain('KG mode')
  })

  it('flags raw setup only for per-finger devices', () => {
    const nativeReport = deriveSetupReadiness({
      profile: baseProfile(),
      testResults: [],
      connected: true,
      deviceCapabilities: {
        totalForce: true,
        perFingerForce: true,
        batteryStatus: false,
        tare: true,
        startStopStreaming: true,
      },
      inputMode: 'MODE_RAW',
      sourceKind: 'Serial',
      verificationStatus: 'verified',
      verificationReason: null,
      tareRequired: true,
      calibrationScales: [0.1, 0.1, 0.1, 0.1],
    })

    const tindeqReport = deriveSetupReadiness({
      profile: baseProfile(),
      testResults: [],
      connected: true,
      deviceCapabilities: {
        totalForce: true,
        perFingerForce: false,
        batteryStatus: true,
        tare: true,
        startStopStreaming: true,
      },
      inputMode: 'MODE_RAW',
      sourceKind: 'Tindeq',
      verificationStatus: 'verified',
      verificationReason: null,
      tareRequired: true,
      calibrationScales: [0, 0, 0, 0],
    })

    expect(nativeReport.states).toContain('raw_mode_needs_tare_or_calibration')
    expect(tindeqReport.states).not.toContain('raw_mode_needs_tare_or_calibration')
  })

  it('collapses to ready when profile, device and benchmark basics are present', () => {
    const profile = baseProfile()

    const report = deriveSetupReadiness({
      profile,
      testResults: [standardMaxResult(profile.profileId)],
      connected: true,
      deviceCapabilities: {
        totalForce: true,
        perFingerForce: true,
        batteryStatus: false,
        tare: true,
        startStopStreaming: true,
      },
      inputMode: 'MODE_KG_DIRECT',
      sourceKind: 'Serial',
      verificationStatus: 'verified',
      verificationReason: null,
      tareRequired: false,
      calibrationScales: [0.1, 0.1, 0.1, 0.1],
    })

    expect(report.ready).toBe(true)
    expect(report.primaryState).toBe('ready')
    expect(report.items).toHaveLength(0)
  })
})
