import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveStore } from '../../stores/liveStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { FINGER_COLORS, FINGER_NAMES, TOTAL_COLOR } from '../../constants/fingers.ts';
import { useAnimationFrame } from '../../hooks/useAnimationFrame.ts';
import { LIVE_PANEL_CATALOG, livePanelLabel } from './testConfig.ts';
import type { AttemptSample, CompletedTestResult, TestProtocol, TestRunnerPhase } from './types.ts';
import type { Hand, ProfileSnapshot } from '../../types/force.ts';
import { sendTareCommand } from '../../live/sessionWorkflow.ts';
import { useAudioCuePlayer } from './guided/audioCues.ts';
import { buildAttemptSampleFromMeasuredFrame, polylinePath } from './guided/liveCapture.ts';
import { QuickControlsCard } from './guided/QuickControlsCard.tsx';
import { buildCompletedResults } from './guided/resultAssembly.ts';
import {
  formatShortDuration,
  formatTimerLabel,
  isTimedPhase,
  otherHand,
  phaseBadgeClass,
  phaseTitle,
} from './guided/runnerState.ts';
import { LiveForcePanel } from './guided/LiveForcePanel.tsx';

interface GuidedTestScreenProps {
  protocol: TestProtocol;
  hand: Hand;
  targetKg: number | null;
  oppositeHandBestPeakKg: number | null;
  alternateHands: boolean;
  profile: ProfileSnapshot | null;
  onComplete: (result: CompletedTestResult | CompletedTestResult[]) => void;
  onCancel: () => void;
}

export function GuidedTestScreen({
  protocol,
  hand,
  targetKg,
  oppositeHandBestPeakKg,
  alternateHands,
  profile,
  onComplete,
  onCancel,
}: GuidedTestScreenProps) {
  const latestKg = useLiveStore(s => s.latestKg);
  const latestPct = useLiveStore(s => s.latestPct);
  const latestTotalKg = useLiveStore(s => s.latestTotalKg);
  const latestMeasuredTotalKg = useLiveStore(s => s.latestMeasuredTotalKg);
  const hasMeaningfulLoad = useLiveStore(s => s.hasMeaningfulLoad);
  const tareRequired = useLiveStore(s => s.tareRequired);
  const connected = useDeviceStore(s => s.connected);

  const secondaryHand = otherHand(hand);
  const trackedHands = useMemo<Hand[]>(
    () => (alternateHands ? [hand, secondaryHand] : [hand]),
    [alternateHands, hand, secondaryHand],
  );

  const [phase, setPhase] = useState<TestRunnerPhase>('ready');
  const [activeHand, setActiveHand] = useState<Hand>(hand);
  const [queuedHand, setQueuedHand] = useState<Hand | null>(null);
  const [visibleLivePanels, setVisibleLivePanels] = useState(protocol.livePanels);
  const [attemptsByHand, setAttemptsByHand] = useState<Record<Hand, AttemptSample[][]>>({
    Left: [],
    Right: [],
  });
  const [handReadyAt, setHandReadyAt] = useState<Record<Hand, number>>({
    Left: 0,
    Right: 0,
  });
  const [phaseStartedAtMs, setPhaseStartedAtMs] = useState<number>(0);
  const [phaseDurationMs, setPhaseDurationMs] = useState<number>(0);
  const [clockMs, setClockMs] = useState<number>(0);
  const [livePreview, setLivePreview] = useState<AttemptSample[]>([]);
  const [attemptStartAtMs, setAttemptStartAtMs] = useState<number>(0);

  const currentSamplesRef = useRef<AttemptSample[]>([]);
  const attemptStartAtMsRef = useRef<number>(0);
  const lastCaptureMsRef = useRef<number>(0);
  const phaseRef = useRef<TestRunnerPhase>(phase);
  const activeHandRef = useRef<Hand>(hand);
  const queuedHandRef = useRef<Hand | null>(null);
  const attemptsByHandRef = useRef<Record<Hand, AttemptSample[][]>>({
    Left: [],
    Right: [],
  });
  const handReadyAtRef = useRef<Record<Hand, number>>({
    Left: 0,
    Right: 0,
  });
  const startedAtIsoRef = useRef<Record<Hand, string>>({
    Left: '',
    Right: '',
  });
  const countdownCueRef = useRef<number | null>(null);
  const previousPhaseRef = useRef<TestRunnerPhase>('ready');
  const { ensureAudioContext, playCountdownBeep, playGoCue, playStopCue } = useAudioCuePlayer();

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    activeHandRef.current = activeHand;
  }, [activeHand]);

  useEffect(() => {
    queuedHandRef.current = queuedHand;
  }, [queuedHand]);

  useEffect(() => {
    attemptsByHandRef.current = attemptsByHand;
  }, [attemptsByHand]);

  useEffect(() => {
    setVisibleLivePanels(protocol.livePanels);
  }, [protocol]);

  const setTimedPhase = useCallback((next: TestRunnerPhase, durationMs: number) => {
    const now = performance.now();
    setPhase(next);
    setPhaseStartedAtMs(now);
    setPhaseDurationMs(durationMs);
    setClockMs(now);
  }, []);

  const moveToNextAttempt = useCallback((nextHand: Hand) => {
    const now = performance.now();
    setActiveHand(nextHand);
    setQueuedHand(null);
    setPhase('next_attempt');
    setPhaseStartedAtMs(now);
    setPhaseDurationMs(0);
    setClockMs(now);
  }, []);

  const finishTest = useCallback(
    (finalAttemptsByHand: Record<Hand, AttemptSample[][]>) => {
      const results = buildCompletedResults({
        protocol,
        hand,
        secondaryHand,
        alternateHands,
        targetKg,
        oppositeHandBestPeakKg,
        profile,
        visibleLivePanels,
        attemptsByHand: finalAttemptsByHand,
        startedAtIsoByHand: startedAtIsoRef.current,
      });
      setPhase('finished');
      setPhaseDurationMs(0);
      setQueuedHand(null);
      onComplete(results);
    },
    [alternateHands, hand, onComplete, oppositeHandBestPeakKg, profile, protocol, secondaryHand, targetKg, visibleLivePanels],
  );

  const advanceAfterRecoveryDecision = useCallback(
    (skipRecovery = false) => {
      const now = performance.now();
      const finalAttemptsByHand = attemptsByHandRef.current;

      if (!alternateHands) {
        if (finalAttemptsByHand[hand].length >= protocol.attemptCount) {
          finishTest(finalAttemptsByHand);
          return;
        }
        if (protocol.restSec > 0 && !skipRecovery) {
          setQueuedHand(hand);
          setTimedPhase('rest', protocol.restSec * 1000);
          return;
        }
        moveToNextAttempt(hand);
        return;
      }

      const currentHand = activeHandRef.current;
      const nextReadyAt = {
        ...handReadyAtRef.current,
        [currentHand]: skipRecovery ? now : now + protocol.restSec * 1000,
      };
      handReadyAtRef.current = nextReadyAt;
      setHandReadyAt(nextReadyAt);

      const unfinishedHands = trackedHands.filter(h => finalAttemptsByHand[h].length < protocol.attemptCount);
      if (unfinishedHands.length === 0) {
        finishTest(finalAttemptsByHand);
        return;
      }

      const preferredHand = otherHand(currentHand);
      const readyHands = unfinishedHands.filter(h => skipRecovery || handReadyAtRef.current[h] <= now);
      const readyNow = readyHands.find(h => h === preferredHand) ?? readyHands[0] ?? null;

      if (readyNow) {
        moveToNextAttempt(readyNow);
        return;
      }

      const nextQueued = unfinishedHands.reduce((best, candidate) =>
        handReadyAtRef.current[candidate] < handReadyAtRef.current[best] ? candidate : best,
      unfinishedHands[0]);

      setQueuedHand(nextQueued);
      setTimedPhase('rest', Math.max(0, handReadyAtRef.current[nextQueued] - now));
    },
    [alternateHands, finishTest, hand, moveToNextAttempt, protocol.attemptCount, protocol.restSec, setTimedPhase, trackedHands],
  );

  const startCountdown = useCallback(() => {
    const currentHand = activeHandRef.current;
    if (!startedAtIsoRef.current[currentHand]) {
      startedAtIsoRef.current[currentHand] = new Date().toISOString();
    }
    countdownCueRef.current = null;
    void ensureAudioContext();
    setTimedPhase('countdown', protocol.countdownSec * 1000);
  }, [ensureAudioContext, protocol.countdownSec, setTimedPhase]);

  const startLiveAttempt = useCallback(() => {
    currentSamplesRef.current = [];
    const now = performance.now();
    attemptStartAtMsRef.current = now;
    setAttemptStartAtMs(now);
    lastCaptureMsRef.current = 0;
    setLivePreview([]);
    setTimedPhase('live_effort', protocol.durationSec * 1000);
  }, [protocol.durationSec, setTimedPhase]);

  const completeLiveAttempt = useCallback(() => {
    const captured = currentSamplesRef.current.slice();
    const currentHand = activeHandRef.current;

    setAttemptsByHand(prev => {
      const next = {
        ...prev,
        [currentHand]: [...prev[currentHand], captured],
      };
      attemptsByHandRef.current = next;
      return next;
    });

    setLivePreview(captured.slice(-500));
    setTimedPhase('hold_complete', 1200);
  }, [setTimedPhase]);

  const handleSkipRecovery = useCallback(() => {
    if (phase !== 'rest') return;

    if (!alternateHands) {
      moveToNextAttempt(hand);
      return;
    }

    const finalAttemptsByHand = attemptsByHandRef.current;
    const unfinishedHands = trackedHands.filter(h => finalAttemptsByHand[h].length < protocol.attemptCount);
    const nextHand = queuedHandRef.current ?? unfinishedHands[0] ?? null;
    if (!nextHand) {
      finishTest(finalAttemptsByHand);
      return;
    }

    const nextReadyAt = {
      ...handReadyAtRef.current,
      [nextHand]: performance.now(),
    };
    handReadyAtRef.current = nextReadyAt;
    setHandReadyAt(nextReadyAt);
    moveToNextAttempt(nextHand);
  }, [alternateHands, finishTest, hand, moveToNextAttempt, phase, protocol.attemptCount, trackedHands]);

  const handleTare = useCallback(() => {
    sendTareCommand();
  }, []);

  const handlePanelToggle = useCallback((panelId: typeof protocol.livePanels[number]) => {
    setVisibleLivePanels(current =>
      current.includes(panelId)
        ? current.filter(id => id !== panelId)
        : [...current, panelId],
    );
  }, [protocol]);

  useEffect(() => {
    if (!isTimedPhase(phase) || phaseDurationMs <= 0) return;
    const now = performance.now();
    const remaining = Math.max(0, phaseDurationMs - (now - phaseStartedAtMs));
    const timer = window.setTimeout(() => {
      if (phase === 'countdown') {
        startLiveAttempt();
        return;
      }
      if (phase === 'live_effort') {
        completeLiveAttempt();
        return;
      }
      if (phase === 'hold_complete') {
        advanceAfterRecoveryDecision(false);
        return;
      }
      if (phase === 'rest') {
        moveToNextAttempt(queuedHandRef.current ?? activeHandRef.current);
      }
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [
    advanceAfterRecoveryDecision,
    completeLiveAttempt,
    moveToNextAttempt,
    phase,
    phaseDurationMs,
    phaseStartedAtMs,
    startLiveAttempt,
  ]);

  useEffect(() => {
    if (!isTimedPhase(phase)) return;
    const intv = window.setInterval(() => setClockMs(performance.now()), 80);
    return () => window.clearInterval(intv);
  }, [phase]);

  const remainingMs = Math.max(0, phaseDurationMs - (clockMs - phaseStartedAtMs));
  const remainingS = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (phase !== 'countdown') {
      countdownCueRef.current = null;
      return;
    }
    if (remainingS <= 0 || countdownCueRef.current === remainingS) return;
    countdownCueRef.current = remainingS;
    playCountdownBeep();
  }, [phase, playCountdownBeep, remainingS]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    if (previousPhase === phase) return;

    if (phase === 'live_effort') {
      playGoCue();
    }
    if (previousPhase === 'live_effort' && phase !== 'live_effort') {
      playStopCue();
    }

    previousPhaseRef.current = phase;
  }, [phase, playGoCue, playStopCue]);

  useAnimationFrame(() => {
    if (phaseRef.current !== 'live_effort') return;
    const now = performance.now();
    const elapsed = now - attemptStartAtMsRef.current;
    if (elapsed - lastCaptureMsRef.current < 16) return;
    lastCaptureMsRef.current = elapsed;

    const live = useLiveStore.getState();
    currentSamplesRef.current.push(buildAttemptSampleFromMeasuredFrame(elapsed, {
      latestMeasuredTotalKg: live.latestMeasuredTotalKg,
      latestMeasuredKg: [
        live.latestMeasuredKg[0],
        live.latestMeasuredKg[1],
        live.latestMeasuredKg[2],
        live.latestMeasuredKg[3],
      ],
      latestMeasuredPct: [
        live.latestMeasuredPct[0],
        live.latestMeasuredPct[1],
        live.latestMeasuredPct[2],
        live.latestMeasuredPct[3],
      ],
    }, protocol));

    if (currentSamplesRef.current.length % 4 === 0) {
      setLivePreview(currentSamplesRef.current.slice(-500));
    }
  });

  const phasePct = phaseDurationMs > 0
    ? Math.max(0, Math.min(100, ((clockMs - phaseStartedAtMs) / phaseDurationMs) * 100))
    : 0;
  const currentAttemptNo = useMemo(() => {
    const completed = attemptsByHand[activeHand].length;
    if (phase === 'hold_complete') return Math.max(1, Math.min(completed, protocol.attemptCount));
    return Math.max(1, Math.min(completed + 1, protocol.attemptCount));
  }, [activeHand, attemptsByHand, phase, protocol.attemptCount]);
  const timerLabel = formatTimerLabel(phase, remainingMs);
  const liveTotals = livePreview.map(s => s.totalKg);
  const chartMax = Math.max(targetKg ?? 0, ...liveTotals, latestMeasuredTotalKg, 5) * 1.15;
  const canTare = connected && phase !== 'countdown' && phase !== 'live_effort' && phase !== 'hold_complete';
  const visiblePanelSet = useMemo(() => new Set(visibleLivePanels), [visibleLivePanels]);
  const hasTargetPanel = visiblePanelSet.has('target') && protocol.targetMode !== 'none';
  const leftPanelsSelected = LIVE_PANEL_CATALOG.filter(panel => panel.slot === 'left' && visiblePanelSet.has(panel.id));
  const showSplitLayout = leftPanelsSelected.length > 0;
  const renderedRightPanelCount =
    Number(hasTargetPanel) +
    Number(visiblePanelSet.has('live_force')) +
    Number(visiblePanelSet.has('contribution')) +
    Number(visiblePanelSet.has('trace'));

  const repeaterStatus = useMemo(() => {
    if (!protocol.repeater || phase !== 'live_effort') return null;
    const elapsed = Math.max(0, clockMs - attemptStartAtMs);
    const cycleMs = (protocol.repeater.onSec + protocol.repeater.offSec) * 1000;
    const cycleNo = Math.floor(elapsed / cycleMs) + 1;
    const inCycleMs = elapsed % cycleMs;
    const onNow = inCycleMs <= protocol.repeater.onSec * 1000;
    return {
      cycleNo,
      mode: onNow ? 'PULL' : 'RELAX',
    };
  }, [attemptStartAtMs, clockMs, phase, protocol.repeater]);

  const handStatusCards = trackedHands.map(testHand => {
    const completed = attemptsByHand[testHand].length;
    const remaining = Math.max(0, protocol.attemptCount - completed);
    const readyInMs = remaining === 0 ? 0 : Math.max(0, handReadyAt[testHand] - clockMs);
    const readyLabel = remaining === 0
      ? 'Done'
      : readyInMs > 0
        ? `Ready in ${formatShortDuration(readyInMs)}`
        : 'Ready now';

    return {
      hand: testHand,
      completed,
      remaining,
      readyLabel,
      active: activeHand === testHand,
    };
  });

  let phaseHint = 'Start when setup and tare are correct.';
  if (phase === 'countdown') phaseHint = 'Hold still, then pull hard on the GO cue.';
  if (phase === 'live_effort') phaseHint = 'Watch the timer. This is the main cue during the effort.';
  if (phase === 'hold_complete') phaseHint = 'Attempt stored.';
  if (phase === 'rest') {
    phaseHint = alternateHands && queuedHand
      ? `${queuedHand} hand is next when recovery ends.`
      : 'Recovery is running. Skip it if you want to start early.';
  }
  if (phase === 'next_attempt') phaseHint = 'Re-tare if needed, then start the next countdown.';
  if (phase === 'finished') phaseHint = 'Test complete.';

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px]">
            <h2 className="text-xl font-semibold">{protocol.name}</h2>
            <p className="text-sm text-muted mt-1">
              {activeHand} hand · Attempt {currentAttemptNo} / {protocol.attemptCount}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {alternateHands && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30">
                Alternate hands
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${phaseBadgeClass(phase)}`}>
              {phaseTitle(phase)}
            </span>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
            >
              Exit Test
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {LIVE_PANEL_CATALOG.map(panel => (
            <label
              key={panel.id}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                visiblePanelSet.has(panel.id)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface-alt text-muted'
              }`}
            >
              <input
                type="checkbox"
                checked={visiblePanelSet.has(panel.id)}
                onChange={() => handlePanelToggle(panel.id)}
                className="accent-blue-500"
              />
              <span>{livePanelLabel(panel.id)}</span>
            </label>
          ))}
        </div>
      </div>

      {!visiblePanelSet.has('timer') && (
        <QuickControlsCard
          phase={phase}
          phaseHint={phaseHint}
          activeHand={activeHand}
          onStart={startCountdown}
          onSkipRecovery={handleSkipRecovery}
        />
      )}

      <div className={`grid gap-4 items-start ${showSplitLayout ? 'grid-cols-1 xl:grid-cols-[minmax(340px,0.84fr)_minmax(0,1.16fr)]' : 'grid-cols-1'}`}>
        {showSplitLayout && (
          <div className="space-y-4 xl:sticky xl:top-4">
            {visiblePanelSet.has('timer') && (
              <div className="bg-surface rounded-2xl border border-border p-5 md:p-7">
                <div className="rounded-[28px] border border-border bg-bg px-4 py-8 md:px-6 md:py-10 text-center">
                  <div className="text-xs uppercase tracking-[0.24em] text-muted">Phase Timer</div>
                  <div className="mt-4 text-[5.5rem] md:text-[7.6rem] xl:text-[8.4rem] leading-none font-bold tabular-nums text-text">
                    {timerLabel}
                  </div>
                  <div className="mt-4 text-sm md:text-base font-medium text-muted">{phaseHint}</div>
                  <div className="mt-6 h-3 rounded-full bg-surface-alt overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.max(0, 100 - phasePct).toFixed(0)}%` }}
                    />
                  </div>
                  {repeaterStatus && (
                    <div className="mt-4 text-sm text-muted">
                      Repetition {repeaterStatus.cycleNo}: <span className="font-semibold text-text">{repeaterStatus.mode}</span>
                    </div>
                  )}
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {(phase === 'ready' || phase === 'next_attempt') && (
                      <button
                        onClick={startCountdown}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white"
                      >
                        {phase === 'ready' ? `Start ${activeHand} Attempt` : `Start ${activeHand} Next Attempt`}
                      </button>
                    )}
                    {phase === 'rest' && (
                      <button
                        onClick={handleSkipRecovery}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-warning text-white"
                      >
                        Skip Recovery
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {visiblePanelSet.has('hand_progress') && (
              <div className={`grid gap-3 ${alternateHands ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-1' : 'grid-cols-2'}`}>
                {!alternateHands && (
                  <>
                    <div className="rounded-xl bg-surface-alt border border-border p-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted">Hand</div>
                      <div className="mt-1 text-lg font-semibold">{activeHand}</div>
                    </div>
                    <div className="rounded-xl bg-surface-alt border border-border p-3">
                      <div className="text-[11px] uppercase tracking-wide text-muted">Attempt</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums">{currentAttemptNo} / {protocol.attemptCount}</div>
                    </div>
                  </>
                )}
                {handStatusCards.map(card => (
                  <div
                    key={card.hand}
                    className={`rounded-xl border p-3 ${
                      card.active ? 'border-primary bg-primary/5' : 'border-border bg-surface-alt'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted">{card.hand} Hand</div>
                      <div className="text-[11px] font-semibold text-muted">{card.readyLabel}</div>
                    </div>
                    <div className="mt-2 text-lg font-semibold tabular-nums">
                      {card.completed} / {protocol.attemptCount}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {visiblePanelSet.has('instructions') && (
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="text-xs text-muted uppercase tracking-wide">Instructions</div>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {protocol.guidance.map(line => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
                {targetKg && (
                  <div className="mt-3 p-2 rounded-lg bg-primary/10 text-primary text-xs">
                    Target: {targetKg.toFixed(1)} kg (band +/-5%)
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {hasTargetPanel && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="text-xs text-muted uppercase tracking-wide">Target Band</div>
              {targetKg !== null ? (
                <div className="mt-2">
                  <div className="text-3xl font-bold tabular-nums text-primary">{targetKg.toFixed(1)} kg</div>
                  <div className="text-xs text-muted mt-1">
                    Template target mode: {protocol.targetMode === 'fixed_kg' ? 'Fixed kg' : 'Percent of known max'}
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
                  No known max reference was found, so this target is currently unavailable.
                </div>
              )}
            </div>
          )}

          {visiblePanelSet.has('live_force') && (
            <LiveForcePanel
              latestTotalKg={latestTotalKg}
              latestKg={latestKg}
              tareRequired={tareRequired}
              canTare={canTare}
              hasMeaningfulLoad={hasMeaningfulLoad}
              onTare={handleTare}
            />
          )}

          {visiblePanelSet.has('contribution') && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="text-xs text-muted uppercase tracking-wide mb-3">Contribution</div>
              {hasMeaningfulLoad ? (
                <div className="space-y-2">
                  {FINGER_NAMES.map((name, i) => (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted">{name}</span>
                        <span className="tabular-nums" style={{ color: FINGER_COLORS[i] }}>
                          {latestPct[i].toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
                        <div
                          className="h-full"
                          style={{ width: `${Math.max(0, Math.min(100, latestPct[i]))}%`, backgroundColor: FINGER_COLORS[i] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-surface-alt border border-border p-4 text-sm text-muted">
                  Percentage view stays hidden until total load is at least 1.0 kg.
                </div>
              )}
            </div>
          )}

          {visiblePanelSet.has('trace') && (
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="text-xs text-muted uppercase tracking-wide mb-2">Live Trace</div>
              <svg viewBox="0 0 640 220" className="w-full h-[220px] md:h-[280px] rounded-lg bg-bg border border-border">
                {targetKg && (
                  <>
                    <line
                      x1="0"
                      x2="640"
                      y1={(220 - ((targetKg * 1.05) / chartMax) * 220).toFixed(1)}
                      y2={(220 - ((targetKg * 1.05) / chartMax) * 220).toFixed(1)}
                      stroke="#3b8df866"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      x2="640"
                      y1={(220 - ((targetKg * 0.95) / chartMax) * 220).toFixed(1)}
                      y2={(220 - ((targetKg * 0.95) / chartMax) * 220).toFixed(1)}
                      stroke="#3b8df866"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  </>
                )}
                <polyline
                  fill="none"
                  stroke={TOTAL_COLOR}
                  strokeWidth="2"
                  points={polylinePath(liveTotals, 640, 220, chartMax)}
                />
              </svg>
              <div className="mt-2 text-xs text-muted">
                Force below 1.0 kg is flattened to zero so you do not see idle noise or false percentage swings.
              </div>
            </div>
          )}

          {renderedRightPanelCount === 0 && (
            <div className="bg-surface rounded-xl border border-border p-6 text-sm text-muted">
              No live data panels selected. Use the panel toggles above to choose what should be visible during the test.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
