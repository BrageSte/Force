import type { Hand } from '../../../types/force.ts';
import type { TestRunnerPhase } from '../types.ts';

export function isTimedPhase(phase: TestRunnerPhase): boolean {
  return phase === 'countdown' || phase === 'live_effort' || phase === 'hold_complete' || phase === 'rest';
}

export function otherHand(hand: Hand): Hand {
  return hand === 'Left' ? 'Right' : 'Left';
}

export function phaseTitle(phase: TestRunnerPhase): string {
  if (phase === 'ready') return 'Ready';
  if (phase === 'countdown') return 'Countdown';
  if (phase === 'live_effort') return 'Pull';
  if (phase === 'hold_complete') return 'Captured';
  if (phase === 'rest') return 'Recovery';
  if (phase === 'next_attempt') return 'Next Attempt';
  return 'Finished';
}

export function phaseBadgeClass(phase: TestRunnerPhase): string {
  if (phase === 'live_effort') return 'bg-primary/15 text-primary';
  if (phase === 'countdown') return 'bg-warning/15 text-warning';
  if (phase === 'rest') return 'bg-warning/10 text-warning';
  if (phase === 'hold_complete') return 'bg-success/15 text-success';
  if (phase === 'finished') return 'bg-success/15 text-success';
  return 'bg-surface-alt text-muted';
}

export function formatTimerLabel(phase: TestRunnerPhase, remainingMs: number): string {
  const remainingS = Math.max(0, Math.ceil(remainingMs / 1000));
  if (!isTimedPhase(phase)) return '--';
  if (phase === 'rest' || remainingS >= 60) {
    const mins = Math.floor(remainingS / 60);
    const secs = `${remainingS % 60}`.padStart(2, '0');
    return `${mins}:${secs}`;
  }
  return `${remainingS}`;
}

export function formatShortDuration(ms: number): string {
  const totalS = Math.max(0, Math.ceil(ms / 1000));
  if (totalS >= 60) {
    const mins = Math.floor(totalS / 60);
    const secs = `${totalS % 60}`.padStart(2, '0');
    return `${mins}:${secs}`;
  }
  return `${totalS}s`;
}
