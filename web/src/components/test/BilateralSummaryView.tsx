import { FINGER_COLORS, FINGER_NAMES } from '../../constants/fingers.ts';
import { bestPeakOfResult } from './testAnalysis.ts';
import type { CompletedTestResult } from './types.ts';

interface BilateralSummaryViewProps {
  leftResult: CompletedTestResult;
  rightResult: CompletedTestResult;
}

interface MetricRow {
  label: string;
  left: string;
  right: string;
  delta: string;
}

function bestAttempt3sMean(result: CompletedTestResult): number {
  return result.attempts[result.summary.bestAttemptNo - 1]?.core.best3sMeanKg ?? 0;
}

function bestFingerPeak(result: CompletedTestResult, fingerIdx: number): number {
  return Math.max(...result.attempts.map(attempt => attempt.core.peakPerFingerKg[fingerIdx]), 0);
}

function deltaString(left: number, right: number, unit = '', digits = 1): string {
  const delta = left - right;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(digits)}${unit}`;
}

function strongerHand(leftValue: number, rightValue: number): 'Left' | 'Right' | 'Even' {
  if (Math.abs(leftValue - rightValue) < 1e-9) return 'Even';
  return leftValue > rightValue ? 'Left' : 'Right';
}

function strongerGapPct(leftValue: number, rightValue: number): number | null {
  const stronger = Math.max(leftValue, rightValue);
  const weaker = Math.min(leftValue, rightValue);
  if (weaker <= 1e-9 || stronger <= 1e-9) return null;
  return ((stronger - weaker) / weaker) * 100;
}

export function BilateralSummaryView({
  leftResult,
  rightResult,
}: BilateralSummaryViewProps) {
  const leftPeak = bestPeakOfResult(leftResult);
  const rightPeak = bestPeakOfResult(rightResult);
  const stronger = strongerHand(leftPeak, rightPeak);
  const gapKg = Math.abs(leftPeak - rightPeak);
  const gapPct = strongerGapPct(leftPeak, rightPeak);

  const comparisonRows: MetricRow[] = [
    {
      label: 'Best Peak',
      left: `${leftPeak.toFixed(1)} kg`,
      right: `${rightPeak.toFixed(1)} kg`,
      delta: deltaString(leftPeak, rightPeak, ' kg'),
    },
    {
      label: 'Best 3s Mean',
      left: `${bestAttempt3sMean(leftResult).toFixed(1)} kg`,
      right: `${bestAttempt3sMean(rightResult).toFixed(1)} kg`,
      delta: deltaString(bestAttempt3sMean(leftResult), bestAttempt3sMean(rightResult), ' kg'),
    },
    {
      label: 'Repeatability',
      left: `${leftResult.summary.repeatabilityScore.toFixed(0)}/100`,
      right: `${rightResult.summary.repeatabilityScore.toFixed(0)}/100`,
      delta: deltaString(leftResult.summary.repeatabilityScore, rightResult.summary.repeatabilityScore, '', 0),
    },
    {
      label: 'Session Trend',
      left: `${leftResult.summary.sessionTrendPct >= 0 ? '+' : ''}${leftResult.summary.sessionTrendPct.toFixed(1)}%`,
      right: `${rightResult.summary.sessionTrendPct >= 0 ? '+' : ''}${rightResult.summary.sessionTrendPct.toFixed(1)}%`,
      delta: deltaString(leftResult.summary.sessionTrendPct, rightResult.summary.sessionTrendPct, '%'),
    },
    {
      label: 'Strongest Finger',
      left: FINGER_NAMES[leftResult.summary.strongestFinger],
      right: FINGER_NAMES[rightResult.summary.strongestFinger],
      delta: strongerHand(
        bestFingerPeak(leftResult, leftResult.summary.strongestFinger),
        bestFingerPeak(rightResult, rightResult.summary.strongestFinger),
      ),
    },
    {
      label: 'Weakest Contributor',
      left: FINGER_NAMES[leftResult.summary.weakestContributor],
      right: FINGER_NAMES[rightResult.summary.weakestContributor],
      delta: 'Focus area',
    },
  ];

  const fingerRows = FINGER_NAMES.map((name, fingerIdx) => {
    const leftFingerPeak = bestFingerPeak(leftResult, fingerIdx);
    const rightFingerPeak = bestFingerPeak(rightResult, fingerIdx);
    return {
      name,
      leftFingerPeak,
      rightFingerPeak,
      delta: leftFingerPeak - rightFingerPeak,
    };
  });

  const largestFingerGap = fingerRows.reduce((best, row) =>
    Math.abs(row.delta) > Math.abs(best.delta) ? row : best,
  );

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Left vs Right Analysis</h2>
            <p className="text-xs text-muted mt-1">
              Compare the latest {leftResult.protocolName} result for each hand and inspect where one hand is ahead.
            </p>
          </div>
          <div className="text-xs text-muted space-y-1">
            <div>Left: {new Date(leftResult.completedAtIso).toLocaleString()}</div>
            <div>Right: {new Date(rightResult.completedAtIso).toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
          <SummaryCard label="Left Best Peak" value={`${leftPeak.toFixed(1)} kg`} subtitle={leftResult.profile?.name ?? 'No profile'} />
          <SummaryCard label="Right Best Peak" value={`${rightPeak.toFixed(1)} kg`} subtitle={rightResult.profile?.name ?? 'No profile'} />
          <SummaryCard
            label="Gap"
            value={`${gapKg.toFixed(1)} kg`}
            subtitle={gapPct === null ? 'Need usable force on both hands' : `${gapPct.toFixed(1)}% between hands`}
          />
          <SummaryCard
            label="Stronger Hand"
            value={stronger}
            subtitle={stronger === 'Even' ? 'Both hands are effectively even' : 'Based on best peak force'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="bg-surface rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-right">Left</th>
                <th className="px-3 py-2 text-right">Right</th>
                <th className="px-3 py-2 text-right">Delta (L-R)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(row => (
                <tr key={row.label} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.left}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.right}</td>
                  <td
                    className="px-3 py-2 text-right tabular-nums"
                    style={{ color: row.delta.startsWith('+') ? '#22c55e' : row.delta.startsWith('-') ? '#ef4444' : undefined }}
                  >
                    {row.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Finger Differences</div>
          <div className="text-xs text-muted mt-1 mb-3">
            Peak force per anatomical finger. Largest gap currently: {largestFingerGap.name}.
          </div>
          <div className="space-y-2">
            {fingerRows.map(row => (
              <div key={row.name} className="rounded-lg border border-border bg-surface-alt p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FINGER_COLORS[FINGER_NAMES.indexOf(row.name)] }} />
                    <span className="text-sm font-medium">{row.name}</span>
                  </div>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: row.delta >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {deltaString(row.leftFingerPeak, row.rightFingerPeak, ' kg')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-muted">
                  <div>Left {row.leftFingerPeak.toFixed(1)} kg</div>
                  <div className="text-right">Right {row.rightFingerPeak.toFixed(1)} kg</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="bg-surface-alt rounded-xl border border-border p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-1">{subtitle}</div>
    </div>
  );
}
