/* eslint-disable react-refresh/only-export-components */
import { FINGER_COLORS, FINGER_NAMES } from '../../constants/fingers.ts';
import { AttemptComparisonView } from './AttemptComparisonView.tsx';
import { FingerDetailView } from './FingerDetailView.tsx';
import { SessionContextView } from './SessionContextView.tsx';
import { RESULT_WIDGET_CATALOG } from './testConfig.ts';
import { bestPeakOfResult } from './testAnalysis.ts';
import type { CompletedTestResult, ResultWidgetId } from './types.ts';

export interface ResultWidgetRenderProps {
  result: CompletedTestResult;
  oppositeHandResult: CompletedTestResult | null;
  sessionResults: CompletedTestResult[];
}

export interface ResultWidgetDescriptor {
  id: ResultWidgetId;
  label: string;
  description: string;
  available: (result: CompletedTestResult) => boolean;
  render: (props: ResultWidgetRenderProps) => React.ReactNode;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function widgetMeta(widgetId: ResultWidgetId) {
  return RESULT_WIDGET_CATALOG.find(widget => widget.id === widgetId) ?? {
    id: widgetId,
    label: widgetId,
    description: '',
  };
}

function polylinePath(values: number[], width: number, height: number, maxY: number): string {
  if (values.length === 0) return '';
  const n = values.length;
  return values
    .map((value, index) => {
      const x = n <= 1 ? 0 : (index / (n - 1)) * width;
      const y = height - (Math.max(0, value) / Math.max(1e-6, maxY)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

const RESULT_WIDGETS: ResultWidgetDescriptor[] = [
  {
    ...widgetMeta('summary'),
    available: () => true,
    render: ({ result }) => {
      const bestPeak = bestPeakOfResult(result);
      const bestAttempt = result.attempts[result.summary.bestAttemptNo - 1];
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard label="Best Peak" value={`${bestPeak.toFixed(1)} kg`} detail={`Best attempt #${result.summary.bestAttemptNo}`} />
            <SummaryCard label="Best 3s Mean" value={`${bestAttempt?.core.best3sMeanKg.toFixed(1) ?? '0.0'} kg`} detail="Best attempt" />
            <SummaryCard label="Repeatability" value={`${result.summary.repeatabilityScore.toFixed(0)}/100`} detail="Across attempts" />
            <SummaryCard
              label="Session Trend"
              value={`${result.summary.sessionTrendPct >= 0 ? '+' : ''}${result.summary.sessionTrendPct.toFixed(1)}%`}
              detail={result.summary.leftRightAsymmetryPct === null
                ? 'No opposite-hand reference yet'
                : `L/R asymmetry ${result.summary.leftRightAsymmetryPct.toFixed(1)}%`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <InterpretCard
              title="Strongest Finger"
              value={FINGER_NAMES[result.summary.strongestFinger]}
              detail="Highest peak force contribution across attempts."
              color={FINGER_COLORS[result.summary.strongestFinger]}
            />
            <InterpretCard
              title="Weakest Contributor"
              value={FINGER_NAMES[result.summary.weakestContributor]}
              detail="Lowest average share at peak."
              color={FINGER_COLORS[result.summary.weakestContributor]}
            />
            <InterpretCard
              title="Most Stable Finger"
              value={FINGER_NAMES[result.summary.mostStableFinger]}
              detail="Lowest contribution variability."
              color={FINGER_COLORS[result.summary.mostStableFinger]}
            />
          </div>
        </div>
      );
    },
  },
  {
    ...widgetMeta('attempt_table'),
    available: result => result.attempts.length > 0,
    render: ({ result }) => (
      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Attempt</th>
              <th className="px-3 py-2 text-right">Peak</th>
              <th className="px-3 py-2 text-right">Best 3s</th>
              <th className="px-3 py-2 text-right">Mean</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-right">Stability</th>
            </tr>
          </thead>
          <tbody>
            {result.attempts.map(attempt => (
              <tr key={attempt.attemptNo} className="border-t border-border">
                <td className="px-3 py-2">{attempt.attemptNo}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{attempt.core.peakTotalKg.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{attempt.core.best3sMeanKg.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{attempt.core.fullTestMeanKg.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{attempt.coaching.balanceScore.toFixed(0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {attempt.coaching.stabilityErrorPct === null ? '--' : `${attempt.coaching.stabilityErrorPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    ...widgetMeta('attempt_overlay'),
    available: result => result.attempts.length > 0,
    render: ({ result }) => <AttemptComparisonView result={result} />,
  },
  {
    ...widgetMeta('finger_detail'),
    available: result => result.attempts.length > 0 && result.capabilities?.perFingerForce !== false,
    render: ({ result, oppositeHandResult }) => (
      <FingerDetailView result={result} oppositeHandResult={oppositeHandResult} />
    ),
  },
  {
    ...widgetMeta('target_stability'),
    available: result =>
      result.targetKg !== null ||
      result.attempts.some(attempt => attempt.coaching.stabilityErrorPct !== null),
    render: ({ result }) => {
      const stabilityValues = result.attempts
        .map(attempt => attempt.coaching.stabilityErrorPct)
        .filter((value): value is number => value !== null);

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SummaryCard
            label="Target"
            value={result.targetKg === null ? '--' : `${result.targetKg.toFixed(1)} kg`}
            detail={result.targetKg === null ? 'No target configured for this run' : 'Resolved target for this run'}
          />
          <SummaryCard
            label="Avg Stability Error"
            value={stabilityValues.length === 0 ? '--' : `${mean(stabilityValues).toFixed(1)}%`}
            detail={stabilityValues.length === 0 ? 'Not available for this test' : 'Average across attempts'}
          />
        </div>
      );
    },
  },
  {
    ...widgetMeta('experimental'),
    available: result =>
      result.attempts.some(attempt =>
        attempt.experimental?.explosive ||
        attempt.experimental?.advancedFatigue ||
        (attempt.experimental?.synergyMatrix?.length ?? 0) > 0,
      ),
    render: ({ result }) => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {result.attempts.map(attempt => (
          <div key={attempt.attemptNo} className="bg-surface-alt rounded-lg border border-border p-3">
            <div className="text-sm font-semibold">Attempt {attempt.attemptNo}</div>
            <div className="text-xs text-muted mt-1">{attempt.experimental?.note ?? 'No experimental metrics for this attempt.'}</div>
            <div className="mt-3 space-y-1 text-sm">
              {attempt.experimental?.explosive && (
                <>
                  <MetricRow label="Time to 50%" value={attempt.experimental.explosive.timeTo50PctPeakMs === null ? '--' : `${attempt.experimental.explosive.timeTo50PctPeakMs.toFixed(0)} ms`} />
                  <MetricRow label="Time to 90%" value={attempt.experimental.explosive.timeTo90PctPeakMs === null ? '--' : `${attempt.experimental.explosive.timeTo90PctPeakMs.toFixed(0)} ms`} />
                  <MetricRow label="0-500ms slope" value={attempt.experimental.explosive.riseSlope0To500msKgS === null ? '--' : `${attempt.experimental.explosive.riseSlope0To500msKgS.toFixed(1)} kg/s`} />
                </>
              )}
              {attempt.experimental?.advancedFatigue && (
                <>
                  <MetricRow label="Repeated decay" value={attempt.experimental.advancedFatigue.repeatedEffortDecayPct === null ? '--' : `${attempt.experimental.advancedFatigue.repeatedEffortDecayPct.toFixed(1)}%`} />
                  <MetricRow label="Final-third mean peak" value={attempt.experimental.advancedFatigue.finalThirdMeanPeakKg === null ? '--' : `${attempt.experimental.advancedFatigue.finalThirdMeanPeakKg.toFixed(1)} kg`} />
                  <MetricRow label="Strategy shift" value={attempt.experimental.advancedFatigue.strategyShiftScore === null ? '--' : attempt.experimental.advancedFatigue.strategyShiftScore.toFixed(2)} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    ...widgetMeta('raw_traces'),
    available: result => result.attempts.some(attempt => attempt.samples.length > 1),
    render: ({ result }) => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {result.attempts.map(attempt => {
          const totalSeries = attempt.samples.map(sample => sample.totalKg);
          const maxY = Math.max(5, ...totalSeries);
          return (
            <div key={attempt.attemptNo} className="bg-surface-alt rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Attempt {attempt.attemptNo}</div>
                <div className="text-xs text-muted tabular-nums">{attempt.durationS.toFixed(1)}s</div>
              </div>
              <svg viewBox="0 0 420 150" className="w-full h-36 mt-2 rounded-lg bg-bg border border-border">
                <polyline
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  points={polylinePath(totalSeries, 420, 150, maxY)}
                />
              </svg>
              <div className="mt-2 text-xs text-muted">
                Peak {attempt.core.peakTotalKg.toFixed(1)} kg · Mean {attempt.core.fullTestMeanKg.toFixed(1)} kg
              </div>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    ...widgetMeta('session_context'),
    available: () => true,
    render: ({ result, sessionResults }) => (
      <SessionContextView currentResult={result} sessionResults={sessionResults} />
    ),
  },
];

export function getResultWidget(widgetId: ResultWidgetId): ResultWidgetDescriptor {
  return RESULT_WIDGETS.find(widget => widget.id === widgetId) ?? RESULT_WIDGETS[0];
}

export function isResultWidgetAvailable(widgetId: ResultWidgetId, result: CompletedTestResult): boolean {
  return getResultWidget(widgetId).available(result);
}

export function listResultWidgets(): ResultWidgetDescriptor[] {
  return RESULT_WIDGETS;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-1">{detail}</div>
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
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{title}</div>
      <div className="text-lg font-semibold mt-1" style={{ color }}>{value}</div>
      <div className="text-xs text-muted mt-1">{detail}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
