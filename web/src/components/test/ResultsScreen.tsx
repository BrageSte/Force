import { FINGER_COLORS, FINGER_NAMES } from '../../constants/fingers.ts';
import { AiCoachingPanel } from './AiCoachingPanel.tsx';
import { bestPeakOfResult } from './testAnalysis.ts';
import type { AiCoachingReport } from './aiCoaching.ts';
import type { CompletedTestResult } from './types.ts';

interface ResultsScreenProps {
  result: CompletedTestResult;
  aiCoachingReport: AiCoachingReport | null;
  onOpenComparison: () => void;
  onOpenFinger: () => void;
  onOpenSession: () => void;
  onBackToLibrary: () => void;
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Moderate';
  return 'Variable';
}

function asymLabel(asymPct: number | null): string {
  if (asymPct === null) return 'No opposite-hand reference yet';
  if (Math.abs(asymPct) < 5) return 'Balanced';
  if (asymPct > 0) return 'Current hand stronger';
  return 'Opposite hand stronger';
}

export function ResultsScreen({
  result,
  aiCoachingReport,
  onOpenComparison,
  onOpenFinger,
  onOpenSession,
  onBackToLibrary,
}: ResultsScreenProps) {
  const bestPeak = bestPeakOfResult(result);
  const bestAttempt = result.attempts[result.summary.bestAttemptNo - 1];
  const strongest = FINGER_NAMES[result.summary.strongestFinger];
  const weakest = FINGER_NAMES[result.summary.weakestContributor];
  const biggestFade = FINGER_NAMES[result.summary.biggestFadeFinger];
  const takeover = FINGER_NAMES[result.summary.takeoverFinger];
  const stable = FINGER_NAMES[result.summary.mostStableFinger];

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-lg font-semibold">{result.protocolName} Result</h2>
          <p className="text-xs text-muted mt-1">
            {new Date(result.completedAtIso).toLocaleString()} | {result.profile?.name ?? 'No profile'} | {result.hand} hand | {result.attempts.length} attempts
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success/15 text-success">
          {result.tier}
        </span>
        <button
          onClick={onBackToLibrary}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
        >
          New Test
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card
          label="Best Peak"
          value={`${bestPeak.toFixed(1)} kg`}
          tone="primary"
          subtitle={`Best attempt #${result.summary.bestAttemptNo}`}
        />
        <Card
          label="Best 3s Mean"
          value={`${bestAttempt?.core.best3sMeanKg.toFixed(1) ?? '0.0'} kg`}
          subtitle="Core metric"
        />
        <Card
          label="Repeatability"
          value={`${result.summary.repeatabilityScore.toFixed(0)}/100`}
          subtitle={scoreLabel(result.summary.repeatabilityScore)}
        />
        <Card
          label="L/R Asymmetry"
          value={result.summary.leftRightAsymmetryPct === null ? '--' : `${result.summary.leftRightAsymmetryPct.toFixed(1)}%`}
          subtitle={asymLabel(result.summary.leftRightAsymmetryPct)}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold mb-3">Key Interpretations</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <InterpretCard
              title="Strongest Finger"
              value={strongest}
              detail="Highest peak force contribution across attempts."
              color={FINGER_COLORS[result.summary.strongestFinger]}
            />
            <InterpretCard
              title="Weakest Contributor"
              value={weakest}
              detail="Lowest average share at peak. Good target for focused work."
              color={FINGER_COLORS[result.summary.weakestContributor]}
            />
            <InterpretCard
              title="Biggest Fade"
              value={biggestFade}
              detail="Largest decline from early to late in attempts."
              color={FINGER_COLORS[result.summary.biggestFadeFinger]}
            />
            <InterpretCard
              title="Takeover Finger"
              value={takeover}
              detail="Most positive share drift later in the effort."
              color={FINGER_COLORS[result.summary.takeoverFinger]}
            />
            <InterpretCard
              title="Most Stable Finger"
              value={stable}
              detail="Lowest contribution variability."
              color={FINGER_COLORS[result.summary.mostStableFinger]}
            />
            <InterpretCard
              title="Session Trend"
              value={`${result.summary.sessionTrendPct.toFixed(1)}%`}
              detail="Change from first to last attempt peak in this test."
              color={result.summary.sessionTrendPct >= -3 ? '#22c55e' : '#ef4444'}
            />
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
          <div className="text-sm font-semibold">Metric Confidence</div>
          <ConfidenceRow label="Core Metrics" level={result.confidence.core} detail="Primary scorecards used for progression tracking." />
          <ConfidenceRow label="Coaching Metrics" level={result.confidence.coaching} detail="Useful interpretation layer for coaching decisions." />
          <ConfidenceRow label="Experimental" level={result.confidence.experimental} detail="Exploratory and trend-focused. Avoid hard conclusions." />

          <div className="pt-2 space-y-2">
            <button
              onClick={onOpenComparison}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white"
            >
              Open Attempt Comparison
            </button>
            <button
              onClick={onOpenFinger}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-surface-alt border border-border text-text"
            >
              Open Finger Detail
            </button>
            <button
              onClick={onOpenSession}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-surface-alt border border-border text-text"
            >
              Open Session Context
            </button>
          </div>
        </div>
      </div>

      {aiCoachingReport && <AiCoachingPanel report={aiCoachingReport} />}
    </div>
  );
}

function Card({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: 'primary';
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums" style={tone ? { color: '#60a5fa' } : undefined}>
        {value}
      </div>
      {subtitle && <div className="text-xs text-muted mt-1">{subtitle}</div>}
    </div>
  );
}

function InterpretCard({
  title,
  value,
  detail,
  color,
}: {
  title: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="bg-surface-alt rounded-lg border border-border p-3">
      <div className="text-xs text-muted">{title}</div>
      <div className="text-base font-semibold mt-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted mt-1">{detail}</div>
    </div>
  );
}

function ConfidenceRow({
  label,
  level,
  detail,
}: {
  label: string;
  level: string;
  detail: string;
}) {
  const cls =
    level === 'High'
      ? 'bg-success/15 text-success'
      : level === 'Moderate'
        ? 'bg-warning/15 text-warning'
        : 'bg-danger/15 text-danger';
  return (
    <div className="bg-surface-alt rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{level}</span>
      </div>
      <div className="text-xs text-muted mt-1">{detail}</div>
    </div>
  );
}
