import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FINGER_COLORS, FINGER_NAMES, displayOrder } from '../../constants/fingers.ts';
import { useAnimationFrame } from '../../hooks/useAnimationFrame.ts';
import { sendTareCommand } from '../../live/sessionWorkflow.ts';
import {
  benchmarkReferenceSourceDescription,
  benchmarkReferenceSourceLabel,
  type BenchmarkReferenceResolution,
} from '../../profile/benchmarkReferences.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import type { Finger4, Hand, ProfileSnapshot } from '../../types/force.ts';
import { capabilitySummary, defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import { buildTrainSimulatorState } from '../../device/simulatorModel.ts';
import type { SimulatorAthleteProfile } from '../../device/simulatorTypes.ts';
import type { CompletedTestResult } from '../test/types.ts';
import { useAudioCuePlayer } from '../test/guided/audioCues.ts';
import { buildTrainSessionResult, buildTrainTimeline, formatGripSpec, plannedRepCount, scoreRepAdherence } from './trainUtils.ts';
import type {
  CustomTrainWorkout,
  TrainProtocol,
  TrainRecommendation,
  TrainRepResult,
  TrainRunnerPhase,
  TrainSessionResult,
  TrainTargetMode,
} from './types.ts';

interface GuidedTrainScreenProps {
  protocol: TrainProtocol | CustomTrainWorkout;
  hand: Hand;
  profile: ProfileSnapshot | null;
  targetMode: TrainTargetMode;
  targetKg: number;
  sourceMaxKg: number | null;
  bodyweightRelativeTarget: number | null;
  benchmarkSourceId?: string;
  benchmarkSourceLabel?: string;
  benchmarkReference: BenchmarkReferenceResolution | null;
  simulatorProfiles: Record<Hand, SimulatorAthleteProfile>;
  previousResult: TrainSessionResult | null;
  recommendation: TrainRecommendation | null;
  latestBenchmark: CompletedTestResult | null;
  onComplete: (result: TrainSessionResult) => void;
  onCancel: () => void;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function impulseKgS(samples: Array<{ tMs: number; totalKg: number }>): number {
  if (samples.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].tMs - samples[i - 1].tMs) / 1000;
    total += ((samples[i - 1].totalKg + samples[i].totalKg) / 2) * dt;
  }
  return total;
}

export function GuidedTrainScreen({
  protocol,
  hand,
  profile,
  targetMode,
  targetKg,
  sourceMaxKg,
  bodyweightRelativeTarget,
  benchmarkSourceId,
  benchmarkSourceLabel,
  benchmarkReference,
  simulatorProfiles,
  previousResult,
  recommendation,
  latestBenchmark,
  onComplete,
  onCancel,
}: GuidedTrainScreenProps) {
  const zeroFinger: Finger4 = [0, 0, 0, 0];
  const latestMeasuredKg = useLiveStore(s => s.latestMeasuredKg) ?? zeroFinger;
  const latestMeasuredPct = useLiveStore(s => s.latestMeasuredPct) ?? zeroFinger;
  const latestMeasuredTotalKg = useLiveStore(s => s.latestMeasuredTotalKg);
  const tareRequired = useLiveStore(s => s.tareRequired);
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const perFingerForce = useDeviceStore(s => (s.activeDevice ?? defaultConnectedDevice(s.sourceKind)).capabilities.perFingerForce);
  const device = activeDevice ?? defaultConnectedDevice(sourceKind);

  const timeline = useMemo(() => buildTrainTimeline(protocol.blocks), [protocol.blocks]);
  const totalPlannedReps = useMemo(() => plannedRepCount(protocol.blocks), [protocol.blocks]);
  const totalTimelineMs = useMemo(() => timeline.reduce((sum, step) => sum + step.durationSec * 1000, 0), [timeline]);

  const [phase, setPhase] = useState<TrainRunnerPhase>('ready');
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [phaseStartedAtMs, setPhaseStartedAtMs] = useState(0);
  const [phaseDurationMs, setPhaseDurationMs] = useState(0);
  const [clockMs, setClockMs] = useState(0);
  const [completedReps, setCompletedReps] = useState<TrainRepResult[]>([]);
  const [startedAtIso, setStartedAtIso] = useState<string | null>(null);
  const [resolvedTargetKg, setResolvedTargetKg] = useState(targetKg);
  const liveForceLabel = targetMode === 'manual'
    ? 'Manual target'
    : targetMode === 'auto_from_first_set'
      ? (resolvedTargetKg > 0 ? `Learned from first set (${resolvedTargetKg.toFixed(1)} kg)` : 'Learning from first set')
      : targetMode === 'bodyweight_relative'
        ? `${bodyweightRelativeTarget?.toFixed(2) ?? '--'} x bodyweight`
        : sourceMaxKg !== null && benchmarkReference?.effectiveSource
          ? `Auto from ${sourceMaxKg.toFixed(1)} kg ${benchmarkReferenceSourceLabel(benchmarkReference.effectiveSource)} reference`
          : sourceMaxKg !== null
            ? `Auto from ${sourceMaxKg.toFixed(1)} kg benchmark`
            : 'Auto target';
  const liveForceReferenceDetail = benchmarkReference?.effectiveSource
    ? `${benchmarkReferenceSourceDescription(benchmarkReference.effectiveSource)}${benchmarkReference.usedFallback ? ' via fallback' : ''}`
    : null;

  const phaseRef = useRef<TrainRunnerPhase>('ready');
  const currentStepIndexRef = useRef(-1);
  const phaseStartedAtMsRef = useRef(0);
  const completedRepsRef = useRef<TrainRepResult[]>([]);
  const currentSamplesRef = useRef<TrainRepResult['samples']>([]);
  const lastCaptureMsRef = useRef(0);
  const countdownCueRef = useRef<number | null>(null);
  const previousPhaseRef = useRef<TrainRunnerPhase>('ready');
  const { ensureAudioContext, playCountdownBeep, playGoCue, playStopCue } = useAudioCuePlayer();

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    phaseStartedAtMsRef.current = phaseStartedAtMs;
  }, [phaseStartedAtMs]);

  useEffect(() => {
    completedRepsRef.current = completedReps;
  }, [completedReps]);

  useEffect(() => {
    setResolvedTargetKg(targetKg);
  }, [targetKg]);
  const fingerOrder = useMemo(() => displayOrder(hand), [hand]);
  const currentStep = currentStepIndex >= 0 ? timeline[currentStepIndex] ?? null : null;

  useEffect(() => {
    useLiveStore.getState().setMeasurementHandOverride(hand);
  }, [hand]);

  useEffect(() => {
    return () => {
      useLiveStore.getState().setMeasurementHandOverride(null);
    };
  }, []);

  useEffect(() => {
    if (sourceKind !== 'Simulator') return;
    const athlete = simulatorProfiles[hand];
    void useDeviceStore.getState().setSimulatorState(buildTrainSimulatorState({
      protocol,
      phase,
      hand,
      athlete,
      currentStep,
      targetKg: resolvedTargetKg,
    }));
  }, [currentStep, hand, phase, protocol, resolvedTargetKg, simulatorProfiles, sourceKind]);

  useEffect(() => {
    if (sourceKind !== 'Simulator') return;
    return () => {
      void useDeviceStore.getState().restoreDefaultSimulatorState({
        hand,
        athlete: simulatorProfiles[hand],
      });
    };
  }, [hand, simulatorProfiles, sourceKind]);

  const setTimedPhase = useCallback((nextPhase: TrainRunnerPhase, durationMs: number) => {
    const now = performance.now();
    setPhase(nextPhase);
    setPhaseStartedAtMs(now);
    setPhaseDurationMs(durationMs);
    setClockMs(now);
  }, []);

  const buildRepResult = useCallback((stepIndex: number) => {
    const step = timeline[stepIndex];
    if (!step || step.kind !== 'work') return null;
    const samples = currentSamplesRef.current.slice();
    const totals = samples.map(sample => sample.totalKg);
    const peakTotalKg = totals.length > 0 ? Math.max(...totals) : 0;
    const avgHoldKg = totals.length > 0 ? mean(totals) : 0;
    const actualHangS = samples.length > 0 ? Math.min(step.durationSec, (samples[samples.length - 1]?.tMs ?? 0) / 1000) : 0;
    const adherencePct = samples.length > 0 && resolvedTargetKg > 0
      ? mean(samples.map(sample => scoreRepAdherence(sample.totalKg, resolvedTargetKg)))
      : 0;

    return {
      sequenceSetNo: step.sequenceSetNo,
      blockId: step.blockId,
      blockLabel: step.blockLabel,
      blockPhase: step.blockPhase,
      setNo: step.setNo,
      repNo: step.repNo,
      plannedHangSec: step.durationSec,
      actualHangS,
      peakTotalKg,
      avgHoldKg,
      impulseKgS: impulseKgS(samples),
      adherencePct,
      samples,
    } satisfies TrainRepResult;
  }, [resolvedTargetKg, timeline]);

  const finalizeSession = useCallback((reps: TrainRepResult[]) => {
    if (!startedAtIso) return;
    const result = buildTrainSessionResult({
      protocol,
      profile,
      hand,
      device,
      startedAtIso,
      targetMode,
      targetKg: resolvedTargetKg,
      sourceMaxKg,
      bodyweightRelativeTarget,
      benchmarkSourceId,
      benchmarkSourceLabel,
      reps,
      previousResult,
      recommendation,
      latestBenchmark,
    });
    setPhase('finished');
    setPhaseDurationMs(0);
    onComplete(result);
  }, [benchmarkSourceId, benchmarkSourceLabel, bodyweightRelativeTarget, device, hand, latestBenchmark, onComplete, previousResult, profile, protocol, recommendation, resolvedTargetKg, sourceMaxKg, startedAtIso, targetMode]);

  const syncCompletedReps = useCallback((next: TrainRepResult[]) => {
    completedRepsRef.current = next;
    setCompletedReps(next);
  }, []);

  const finalizeCurrentWorkStep = useCallback((baseReps: TrainRepResult[]) => {
    const rep = buildRepResult(currentStepIndexRef.current);
    currentSamplesRef.current = [];
    if (!rep) return baseReps;
    const next = [...baseReps, rep];
    const currentStep = timeline[currentStepIndexRef.current];
    if (targetMode === 'auto_from_first_set' && resolvedTargetKg <= 0 && currentStep?.kind === 'work') {
      const firstSetReps = next.filter(item => item.setNo === currentStep.setNo);
      const blockWorkReps = timeline.filter(step => step.kind === 'work' && step.setNo === currentStep.setNo && step.blockId === currentStep.blockId).length;
      if (firstSetReps.length >= blockWorkReps && firstSetReps.length > 0) {
        const learnedTargetKg = Number(mean(firstSetReps.map(item => item.peakTotalKg)).toFixed(2));
        setResolvedTargetKg(learnedTargetKg);
      }
    }
    syncCompletedReps(next);
    return next;
  }, [buildRepResult, resolvedTargetKg, syncCompletedReps, targetMode, timeline]);

  const beginStep = useCallback((stepIndex: number, repsOverride?: TrainRepResult[]) => {
    if (stepIndex >= timeline.length) {
      finalizeSession(repsOverride ?? completedRepsRef.current);
      return;
    }

    const step = timeline[stepIndex];
    setCurrentStepIndex(stepIndex);
    if (step.kind === 'work') {
      currentSamplesRef.current = [];
      lastCaptureMsRef.current = 0;
      const workPhase: TrainRunnerPhase = step.blockPhase === 'warmup'
        ? 'warmup'
        : step.blockPhase === 'cooldown'
          ? 'cooldown'
          : 'work';
      setTimedPhase(workPhase, step.durationSec * 1000);
      return;
    }
    setTimedPhase(step.kind, step.durationSec * 1000);
  }, [finalizeSession, setTimedPhase, timeline]);

  const handleStart = useCallback(() => {
    const nowIso = new Date().toISOString();
    setStartedAtIso(nowIso);
    syncCompletedReps([]);
    currentSamplesRef.current = [];
    setCurrentStepIndex(-1);
    countdownCueRef.current = null;
    void ensureAudioContext();
    setTimedPhase('countdown', 3000);
  }, [ensureAudioContext, setTimedPhase, syncCompletedReps]);

  const handleFinishNow = useCallback(() => {
    if (!startedAtIso) return;
    const nextReps = ['work', 'warmup', 'cooldown'].includes(phaseRef.current)
      ? finalizeCurrentWorkStep(completedRepsRef.current)
      : completedRepsRef.current;
    if (nextReps.length === 0) return;
    finalizeSession(nextReps);
  }, [finalizeCurrentWorkStep, finalizeSession, startedAtIso]);

  useEffect(() => {
    if (!['countdown', 'warmup', 'work', 'rest', 'set_rest', 'cooldown'].includes(phase) || phaseDurationMs <= 0) return;
    const remaining = Math.max(0, phaseDurationMs - (performance.now() - phaseStartedAtMs));
    const timer = window.setTimeout(() => {
      if (phase === 'countdown') {
        beginStep(0);
        return;
      }
      if (['warmup', 'work', 'cooldown'].includes(phase)) {
        const nextReps = finalizeCurrentWorkStep(completedRepsRef.current);
        beginStep(currentStepIndexRef.current + 1, nextReps);
        return;
      }
      beginStep(currentStepIndexRef.current + 1);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [beginStep, finalizeCurrentWorkStep, phase, phaseDurationMs, phaseStartedAtMs]);

  useEffect(() => {
    if (!['countdown', 'warmup', 'work', 'rest', 'set_rest', 'cooldown'].includes(phase)) return;
    const interval = window.setInterval(() => {
      setClockMs(performance.now());
    }, 80);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'countdown') {
      countdownCueRef.current = null;
      return;
    }
    const remainingS = Math.ceil(Math.max(0, phaseDurationMs - (clockMs - phaseStartedAtMs)) / 1000);
    if (remainingS <= 0 || countdownCueRef.current === remainingS) return;
    countdownCueRef.current = remainingS;
    playCountdownBeep();
  }, [clockMs, phase, phaseDurationMs, phaseStartedAtMs, playCountdownBeep]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    if (phase === previousPhase) return;

    if (['warmup', 'work', 'cooldown'].includes(phase)) {
      playGoCue();
    }
    if (['warmup', 'work', 'cooldown'].includes(previousPhase) && phase !== previousPhase) {
      playStopCue();
    }

    previousPhaseRef.current = phase;
  }, [phase, playGoCue, playStopCue]);

  useAnimationFrame(() => {
    if (!['warmup', 'work', 'cooldown'].includes(phaseRef.current)) return;
    const elapsedMs = performance.now() - phaseStartedAtMsRef.current;
    if (elapsedMs - lastCaptureMsRef.current < 16) return;
    lastCaptureMsRef.current = elapsedMs;
    const live = useLiveStore.getState();
    currentSamplesRef.current.push({
      tMs: elapsedMs,
      totalKg: live.latestMeasuredTotalKg,
      fingerKg: live.latestMeasuredKg ?? zeroFinger,
      fingerPct: live.latestMeasuredPct ?? zeroFinger,
      targetKg: resolvedTargetKg > 0 ? resolvedTargetKg : targetKg,
    });
  });

  const remainingMs = Math.max(0, phaseDurationMs - (clockMs - phaseStartedAtMs));
  const remainingProgramMs = useMemo(() => {
    const futureMs = timeline
      .slice(Math.max(currentStepIndex + 1, 0))
      .reduce((sum, step) => sum + step.durationSec * 1000, 0);
    return remainingMs + futureMs;
  }, [currentStepIndex, remainingMs, timeline]);
  const completedTimelineMs = useMemo(() => {
    const done = timeline
      .slice(0, Math.max(currentStepIndex, 0))
      .reduce((sum, step) => sum + step.durationSec * 1000, 0);
    return done + Math.max(0, phaseDurationMs - remainingMs);
  }, [currentStepIndex, phaseDurationMs, remainingMs, timeline]);
  const progressPct = totalTimelineMs > 0 ? (completedTimelineMs / totalTimelineMs) * 100 : 0;
  const canSaveNow = completedReps.length > 0 || ['warmup', 'work', 'cooldown'].includes(phase);

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4 flex items-start gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Guided Workout</div>
          <h2 className="text-xl font-semibold mt-1">{protocol.name}</h2>
          <p className="text-xs text-muted mt-1">
            {profile?.name ?? 'Unknown profile'} | {hand} hand | {formatGripSpec(protocol.gripType, protocol.modality)}
          </p>
          <p className="text-xs text-muted mt-1">
            {device.deviceLabel} · {capabilitySummary(device.capabilities)}
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge label={phaseLabel(phase)} tone={phaseTone(phase)} />
          <button onClick={handleFinishNow} disabled={!canSaveNow} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/25 disabled:opacity-40">
            Finish & Save
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text">
            Cancel
          </button>
        </div>
      </div>

      {!connected && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Device stream is disconnected. Connect the board before starting or the workout will capture zeros.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="bg-surface rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Session Progress</div>
              <div className="text-sm font-semibold mt-1">
                {currentStep ? `${currentStep.blockLabel} · set ${currentStep.sequenceSetNo} rep ${currentStep.repNo}` : phase === 'countdown' ? 'Starting session' : 'Ready to start'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Remaining</div>
              <div className="text-sm font-semibold">{formatTimer(remainingProgramMs)}</div>
            </div>
          </div>

          <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(progressPct, 100))}%` }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4 items-stretch">
            <div className={`rounded-2xl border p-5 ${phaseHeroClass(phase)}`}>
              <div className="text-xs uppercase tracking-wide text-muted">Countdown</div>
              <div className="mt-3 text-7xl font-black tabular-nums leading-none">
                {formatHeroValue(remainingMs)}
              </div>
              <div className="mt-3 text-sm text-muted">
                {currentStep?.cue ?? phaseInstruction(phase)}
              </div>
              {phase === 'ready' && (
                <button
                  onClick={handleStart}
                  disabled={!connected}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-30"
                >
                  Start Workout
                </button>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <SmallStat label="Block phase" value={currentStep ? blockPhaseLabel(currentStep.blockPhase) : phaseLabel(phase)} />
                <SmallStat label="Completed reps" value={`${completedReps.length}/${totalPlannedReps}`} />
                  <SmallStat label="Target" value={resolvedTargetKg > 0 ? `${resolvedTargetKg.toFixed(1)} kg` : 'Learning'} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface-alt p-4">
                <div className="text-xs uppercase tracking-wide text-muted">Live Force</div>
                <div className="text-5xl font-black tabular-nums mt-2" style={{ color: '#60a5fa' }}>
                  {latestMeasuredTotalKg.toFixed(1)}
                </div>
                <div className="text-xs text-muted mt-1">
                  {liveForceLabel}
                </div>
                <div className="mt-3">
                  <TargetBandGauge value={latestMeasuredTotalKg} targetKg={resolvedTargetKg > 0 ? resolvedTargetKg : targetKg} disabled={targetMode === 'auto_from_first_set' && resolvedTargetKg <= 0} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>Benchmark</span>
                  <span>{benchmarkSourceLabel ?? latestBenchmark?.protocolName ?? 'Manual / custom'}</span>
                </div>
                {liveForceReferenceDetail && (
                  <div className="mt-2 text-xs text-muted">
                    Reference: {liveForceReferenceDetail}
                  </div>
                )}
                <button onClick={() => sendTareCommand('Tare command sent from v1.5 train runner')} disabled={!connected || phase === 'work'} className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-semibold bg-surface border border-border text-text disabled:opacity-30">
                  Tare
                </button>
                {targetMode === 'auto_from_first_set' && resolvedTargetKg <= 0 && (
                  <div className="mt-2 text-xs text-warning">
                    First set is used to learn the session target. Pull normally on the opening set.
                  </div>
                )}
                {tareRequired && (
                  <div className="mt-2 text-xs text-danger">
                    Tare is recommended before the next rep.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-alt p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Finger Contribution</div>
                <div className="text-sm font-semibold mt-1">
                  {perFingerForce ? 'Live per-finger load and share' : 'Unavailable on this device'}
                </div>
              </div>
              {recommendation && (
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold uppercase bg-primary/15 text-primary">
                  {recommendation.priority}
                </span>
              )}
            </div>
            {perFingerForce ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {fingerOrder.map(index => (
                  <FingerMeter
                    key={FINGER_NAMES[index]}
                    label={FINGER_NAMES[index]}
                    color={FINGER_COLORS[index]}
                    kg={latestMeasuredKg[index]}
                    pct={latestMeasuredPct[index]}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-muted">
                This device provides total force only, so per-finger contribution is hidden.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Workout Notes</div>
            <div className="mt-3 space-y-2 text-sm">
              <DetailRow label="Source basis" value={protocol.sourceBasis} />
              <DetailRow label="Warm-up" value={protocol.warmup[0]?.label ?? 'Preset warm-up'} />
              <DetailRow label="Recovery" value={protocol.recoveryNotes[0] ?? 'No recovery note'} />
              <DetailRow label="Previous session" value={previousResult ? `${previousResult.summary.peakTotalKg.toFixed(1)} kg peak` : 'No previous session'} />
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="text-xs uppercase tracking-wide text-muted">Program Grid</div>
            <div className="mt-3 space-y-2">
              {protocol.blocks.map(block => (
                <div key={block.id} className={`rounded-lg border px-3 py-3 ${currentStep?.blockId === block.id ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface-alt'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{block.label}</div>
                    <span className="text-[10px] uppercase text-muted">{blockPhaseLabel(block.phase)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {block.setCount} set · {block.repsPerSet} rep · {block.hangSec}s on / {block.restBetweenRepsSec}s off
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Captured Reps</h3>
          <p className="text-xs text-muted mt-1">Rep-by-rep force, impulse and adherence while the workout runs.</p>
        </div>
        {completedReps.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">
            No reps captured yet. Countdown and live capture begin after you start the workout.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Set</th>
                <th className="px-4 py-2.5 text-left">Block</th>
                <th className="px-4 py-2.5 text-left">Rep</th>
                <th className="px-4 py-2.5 text-right">Hang</th>
                <th className="px-4 py-2.5 text-right">Avg</th>
                <th className="px-4 py-2.5 text-right">Peak</th>
                <th className="px-4 py-2.5 text-right">Impulse</th>
                <th className="px-4 py-2.5 text-right">Adherence</th>
              </tr>
            </thead>
            <tbody>
              {completedReps.map(rep => (
                <tr key={`${rep.sequenceSetNo ?? rep.setNo}-${rep.repNo}-${rep.blockId ?? 'set'}`} className="border-t border-border">
                  <td className="px-4 py-2.5">{rep.sequenceSetNo ?? rep.setNo}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{rep.blockLabel ?? 'Workout block'}</td>
                  <td className="px-4 py-2.5">{rep.repNo}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.actualHangS.toFixed(1)}s</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.avgHoldKg.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{rep.peakTotalKg.toFixed(1)} kg</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.impulseKgS.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rep.adherencePct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'primary' }) {
  const classes = {
    neutral: 'bg-surface-alt text-muted',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    primary: 'bg-primary/15 text-primary',
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${classes[tone]}`}>{label}</span>;
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface/70 border border-border px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function FingerMeter({ label, color, kg, pct }: { label: string; color: string; kg: number; pct: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold" style={{ color }}>{label}</div>
        <div className="text-xs text-muted">{pct.toFixed(0)}%</div>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{kg.toFixed(1)} kg</div>
      <div className="mt-3 h-2 rounded-full bg-surface-alt overflow-hidden">
        <div className="h-full" style={{ width: `${Math.max(0, Math.min(pct, 100))}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function TargetBandGauge({ value, targetKg, disabled }: { value: number; targetKg: number; disabled?: boolean }) {
  if (disabled || targetKg <= 0) {
    return (
      <div className="space-y-2">
        <div className="h-3 rounded-full bg-bg overflow-hidden relative border border-border" />
        <div className="text-xs text-muted">Target band activates after the learning set.</div>
      </div>
    );
  }
  const low = targetKg * 0.95;
  const high = targetKg * 1.05;
  const pct = targetKg > 0 ? Math.max(0, Math.min((value / (targetKg * 1.4)) * 100, 100)) : 0;
  const within = value >= low && value <= high;
  return (
    <div className="space-y-2">
      <div className="h-3 rounded-full bg-bg overflow-hidden relative border border-border">
        <div className="absolute inset-y-0 bg-success/20" style={{ left: `${(low / (targetKg * 1.4)) * 100}%`, width: `${((high - low) / (targetKg * 1.4)) * 100}%` }} />
        <div className={`h-full ${within ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{low.toFixed(1)} kg</span>
        <span>Target {targetKg.toFixed(1)} kg</span>
        <span>{high.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

function phaseLabel(phase: TrainRunnerPhase): string {
  if (phase === 'ready') return 'Ready';
  if (phase === 'countdown') return 'Countdown';
  if (phase === 'warmup') return 'Warm-up';
  if (phase === 'work') return 'Work';
  if (phase === 'rest') return 'Rest';
  if (phase === 'set_rest') return 'Set Rest';
  if (phase === 'cooldown') return 'Cooldown';
  return 'Finished';
}

function phaseTone(phase: TrainRunnerPhase): 'neutral' | 'success' | 'warning' | 'primary' {
  if (phase === 'work') return 'primary';
  if (phase === 'countdown' || phase === 'rest' || phase === 'set_rest' || phase === 'warmup' || phase === 'cooldown') return 'warning';
  if (phase === 'finished') return 'success';
  return 'neutral';
}

function phaseHeroClass(phase: TrainRunnerPhase): string {
  if (phase === 'work') return 'bg-primary/5 border-primary/20';
  if (phase === 'warmup') return 'bg-warning/10 border-warning/20';
  if (phase === 'rest' || phase === 'set_rest') return 'bg-surface-alt border-border';
  if (phase === 'finished') return 'bg-success/5 border-success/20';
  return 'bg-bg border-border';
}

function formatTimer(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatHeroValue(totalMs: number): string {
  return Math.max(0, Math.ceil(totalMs / 1000)).toString();
}

function phaseInstruction(phase: TrainRunnerPhase): string {
  if (phase === 'ready') return 'Press start when the setup is stable and the target feels realistic.';
  if (phase === 'countdown') return 'Set body position and build tension before the cue.';
  if (phase === 'warmup') return 'Warm-up reps should feel smooth and clean.';
  if (phase === 'work') return 'Hit the target quickly and keep finger distribution quiet.';
  if (phase === 'rest' || phase === 'set_rest') return 'Reset breathing, shake out, and prepare for the next rep.';
  if (phase === 'cooldown') return 'Ease off and finish the session cleanly.';
  return 'Session finished.';
}

function blockPhaseLabel(phase: 'warmup' | 'main' | 'cooldown'): string {
  if (phase === 'main') return 'Main';
  if (phase === 'warmup') return 'Warm-up';
  return 'Cooldown';
}
