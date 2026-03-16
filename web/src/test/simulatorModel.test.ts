import { describe, expect, it } from 'vitest'
import { getProtocolById } from '../components/test/testLibrary.ts'
import { buildTrainTimeline } from '../components/train/trainUtils.ts'
import { getTrainProtocolById } from '../components/train/trainLibrary.ts'
import { createDefaultSimulatorAthleteProfile } from '../device/simulatorAthlete.ts'
import {
  buildGuidedSimulatorBlueprint,
  buildTestSimulatorState,
  buildTrainSimulatorState,
  sampleSimulatorBlueprintKg,
  simulatorValuesForStreamMode,
} from '../device/simulatorModel.ts'
import type { Finger4 } from '../types/force.ts'

function totalKg(values: Finger4): number {
  return values.reduce((sum, value) => sum + value, 0)
}

function sharePct(values: Finger4): Finger4 {
  const total = Math.max(totalKg(values), 1e-9)
  return values.map(value => (value / total) * 100) as Finger4
}

describe('simulator pattern generation', () => {
  const athlete = createDefaultSimulatorAthleteProfile({ referenceMaxKg: 40 })

  it('builds the standard max ladder from the athlete reference max', () => {
    const state = buildTestSimulatorState({
      protocol: getProtocolById('standard_max'),
      phase: 'live_effort',
      hand: 'Right',
      athlete,
      targetKg: null,
      attemptNo: 2,
    })

    expect(state.phase).toBe('work')
    expect(state.pattern).toBe('max_pull')
    expect(state.targetKg).toBeCloseTo(34.4, 4)
  })

  it('keeps health holds steady with bounded share drift', () => {
    const state = buildTestSimulatorState({
      protocol: getProtocolById('distribution_hold'),
      phase: 'live_effort',
      hand: 'Right',
      athlete,
      targetKg: 28,
      attemptNo: 1,
    })
    const blueprint = buildGuidedSimulatorBlueprint(state)

    expect(blueprint).not.toBeNull()
    const early = sampleSimulatorBlueprintKg({ ...blueprint!, noiseStdKg: 0 }, 4_000)!
    const late = sampleSimulatorBlueprintKg({ ...blueprint!, noiseStdKg: 0 }, 15_000)!

    const earlyPct = sharePct(early)
    const latePct = sharePct(late)
    const maxDrift = Math.max(...earlyPct.map((value, index) => Math.abs(value - latePct[index])))

    expect(totalKg(early)).toBeGreaterThan(20)
    expect(totalKg(late)).toBeGreaterThan(20)
    expect(maxDrift).toBeLessThan(3)
  })

  it('drops to near-zero during repeater off phases and decays across later cycles', () => {
    const state = buildTestSimulatorState({
      protocol: getProtocolById('advanced_repeater'),
      phase: 'live_effort',
      hand: 'Right',
      athlete,
      targetKg: null,
      attemptNo: 1,
    })
    const blueprint = buildGuidedSimulatorBlueprint(state)

    expect(blueprint?.pattern).toBe('repeater')
    const firstOn = sampleSimulatorBlueprintKg({ ...blueprint!, noiseStdKg: 0 }, 2_000)!
    const firstOff = sampleSimulatorBlueprintKg({ ...blueprint!, noiseStdKg: 0 }, 8_500)!
    const lateOn = sampleSimulatorBlueprintKg({ ...blueprint!, noiseStdKg: 0 }, 232_000)!

    expect(totalKg(firstOn)).toBeGreaterThan(20)
    expect(totalKg(firstOff)).toBeLessThan(0.2)
    expect(totalKg(lateOn)).toBeLessThan(totalKg(firstOn))
  })

  it('uses a fast onset for explosive pulls and a progressive plateau for force-curve work', () => {
    const explosiveState = buildTestSimulatorState({
      protocol: getProtocolById('explosive_pull'),
      phase: 'live_effort',
      hand: 'Right',
      athlete,
      targetKg: null,
      attemptNo: 1,
    })
    const explosive = buildGuidedSimulatorBlueprint(explosiveState)
    const explosiveEarly = sampleSimulatorBlueprintKg({ ...explosive!, noiseStdKg: 0 }, 180)!
    const explosiveLate = sampleSimulatorBlueprintKg({ ...explosive!, noiseStdKg: 0 }, 900)!

    expect(totalKg(explosiveEarly)).toBeGreaterThan(totalKg(explosiveLate))

    const curveState = buildTestSimulatorState({
      protocol: getProtocolById('force_curve_profile'),
      phase: 'live_effort',
      hand: 'Right',
      athlete,
      targetKg: null,
      attemptNo: 1,
    })
    const curve = buildGuidedSimulatorBlueprint(curveState)
    const curveRamp = sampleSimulatorBlueprintKg({ ...curve!, noiseStdKg: 0 }, 1_000)!
    const curvePlateau = sampleSimulatorBlueprintKg({ ...curve!, noiseStdKg: 0 }, 7_000)!
    const curveRelease = sampleSimulatorBlueprintKg({ ...curve!, noiseStdKg: 0 }, 11_000)!

    expect(totalKg(curvePlateau)).toBeGreaterThan(totalKg(curveRamp))
    expect(totalKg(curveRelease)).toBeLessThan(totalKg(curvePlateau))
  })

  it('builds train work states with reduced warmup target and raw-mode conversion', () => {
    const protocol = getTrainProtocolById('strength_10s')
    const timeline = buildTrainTimeline(protocol.blocks)
    const warmupStep = timeline[0] ?? null
    const state = buildTrainSimulatorState({
      protocol,
      phase: 'warmup',
      hand: 'Left',
      athlete,
      currentStep: warmupStep,
      targetKg: 20,
    })

    expect(state.phase).toBe('work')
    expect(state.targetKg).toBe(12)

    const rawValues = simulatorValuesForStreamMode([3, 4, 5, 6], 'raw', [10, 20, 30, 40], [0.5, 1, 0.25, 2])
    expect(rawValues).toEqual([16, 24, 50, 43])
  })
})
