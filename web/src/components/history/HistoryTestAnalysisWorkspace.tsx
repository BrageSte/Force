import { FINGER_COLORS, FINGER_NAMES } from '../../constants/fingers.ts';
import { EmptyState } from '../shared/EmptyState.tsx';
import { formatDateTime } from '../shared/formatDateTime.ts';
import { testFamilyLabel } from '../test/testConfig.ts';
import { bestPeakOfResult } from '../test/testAnalysis.ts';
import type { CompletedTestResult } from '../test/types.ts';
import {
  findOppositeHandHistoryResult,
  oppositeHandDeltaPct,
  orderHistoryTestResults,
  resolveSelectedHistoryTestResult,
  sameProtocolHistoryCount,
} from './historyTestAnalysis.ts';

interface HistoryTestAnalysisWorkspaceProps {
  results: CompletedTestResult[];
  selectedResultId: string | null;
  onSelectResult: (resultId: string) => void;
}

function formatSigned(value: number, digits = 1, suffix = ''): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${suffix}`;
}

function formatNullable(value: number | null | undefined, digits = 1, suffix = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return `${value.toFixed(digits)}${suffix}`;
}

export function HistoryTestAnalysisWorkspace({
  results,
  selectedResultId,
  onSelectResult,
}: HistoryTestAnalysisWorkspaceProps) {
  const orderedResults = orderHistoryTestResults(results);
  const selectedResult = resolveSelectedHistoryTestResult(results, selectedResultId);
  const oppositeResult = findOppositeHandHistoryResult(results, selectedResult);

  if (orderedResults.length === 0 || !selectedResult) {
    return <EmptyState message="No test results available to analyze yet." />;
  }

  const bestPeak = bestPeakOfResult(selectedResult);
  const bestAttempt = selectedResult.attempts[selectedResult.summary.bestAttemptNo - 1] ?? selectedResult.attempts[0] ?? null;
  const bestAttempt3s = bestAttempt?.core.best3sMeanKg ?? 0;
  const oppositeDelta = oppositeHandDeltaPct(selectedResult, oppositeResult);
  const sameProtocolCount = sameProtocolHistoryCount(results, selectedResult);
  const benchmarkScore = selectedResult.summary.benchmarkScore?.overall ?? null;
  const safetyFlags = selectedResult.summary.safetyFlags ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
      <div className="space-y-3">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Select Test</div>
          <div className="text-xs text-muted mt-1">
            Pick any saved test to inspect the parameters and per-attempt values stored with it.
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-2 max-h-[820px] overflow-auto space-y-2">
          {orderedResults.map(result => {
            const active = result.resultId === selectedResult.resultId;
            return (
              <button
                key={result.resultId}
                onClick={() => onSelectResult(result.resultId)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-transparent bg-primary text-white'
                    : 'border-border bg-surface-alt text-text hover:border-primary/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{result.templateName ?? result.protocolName}</div>
                    <div className={`text-[11px] mt-1 ${active ? 'text-white/80' : 'text-muted'}`}>
                      {formatDateTime(result.completedAtIso)}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium ${active ? 'text-white/85' : 'text-muted'}`}>
                    {result.hand}
                  </span>
                </div>
                <div className={`mt-2 flex items-center justify-between gap-3 text-xs ${active ? 'text-white/80' : 'text-muted'}`}>
                  <span>{result.attempts.length} attempts</span>
                  <span className="tabular-nums">{bestPeakOfResult(result).toFixed(1)} kg</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selectedResult.templateName ?? selectedResult.protocolName}</h2>
              <p className="text-xs text-muted mt-1">
                {formatDateTime(selectedResult.completedAtIso)} · {selectedResult.hand} hand · {selectedResult.attempts.length} attempts · {sameProtocolCount} saved run{sameProtocolCount === 1 ? '' : 's'} on this test
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
                {testFamilyLabel(selectedResult.compareTags.family)}
              </span>
              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-surface-alt border border-border text-muted">
                {selectedResult.protocolKind === 'custom' ? 'Custom test' : 'Built-in test'}
              </span>
              <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-surface-alt border border-border text-muted">
                {selectedResult.tier}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <MetricCard label="Best Peak" value={`${bestPeak.toFixed(1)} kg`} note={`Best attempt #${selectedResult.summary.bestAttemptNo}`} />
          <MetricCard label="Best 3s Mean" value={`${bestAttempt3s.toFixed(1)} kg`} note="Best attempt average" />
          <MetricCard label="Target" value={selectedResult.targetKg === null ? '--' : `${selectedResult.targetKg.toFixed(1)} kg`} note={selectedResult.effectiveProtocol.targetMode} />
          <MetricCard label="Repeatability" value={`${selectedResult.summary.repeatabilityScore.toFixed(0)}/100`} note="Across attempts" />
          <MetricCard
            label="Session Trend"
            value={formatSigned(selectedResult.summary.sessionTrendPct, 1, '%')}
            note="First to last attempt"
          />
          <MetricCard
            label="L/R Asymmetry"
            value={formatNullable(selectedResult.summary.leftRightAsymmetryPct, 1, '%')}
            note={selectedResult.summary.leftRightAsymmetryPct === null ? 'No opposite-hand reference' : 'Stored with the result'}
          />
          <MetricCard
            label="Benchmark Score"
            value={benchmarkScore === null ? '--' : benchmarkScore.toFixed(0)}
            note={selectedResult.summary.tacticalGripProfile ?? 'No tactical profile'}
          />
          <MetricCard
            label="BW Relative Peak"
            value={formatNullable(selectedResult.summary.normalizedPeakKgPerKgBodyweight, 2, ' xBW')}
            note="If bodyweight was available"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="text-sm font-semibold mb-3">Stored Test Parameters</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <InfoCard label="Category" value={selectedResult.effectiveProtocol.category} />
              <InfoCard label="Grip Type" value={selectedResult.effectiveProtocol.gripType} />
              <InfoCard label="Modality" value={selectedResult.effectiveProtocol.modality} />
              <InfoCard label="Hand Mode" value={selectedResult.effectiveProtocol.handMode} />
              <InfoCard label="Target Mode" value={selectedResult.effectiveProtocol.targetMode} />
              <InfoCard label="Duration" value={`${selectedResult.effectiveProtocol.durationSec}s`} />
              <InfoCard label="Attempt Count" value={String(selectedResult.effectiveProtocol.attemptCount)} />
              <InfoCard label="Rest Between Attempts" value={`${selectedResult.effectiveProtocol.restSec}s`} />
              <InfoCard label="Countdown" value={`${selectedResult.effectiveProtocol.countdownSec}s`} />
              <InfoCard label="Athlete Level" value={selectedResult.effectiveProtocol.athleteLevel} />
              <InfoCard label="Purpose" value={selectedResult.effectiveProtocol.purpose} />
              <InfoCard label="Scoring Model" value={selectedResult.effectiveProtocol.scoringModel} />
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="text-sm font-semibold">Interpretation Snapshot</div>
            <InfoCard
              label="Strongest Finger"
              value={FINGER_NAMES[selectedResult.summary.strongestFinger]}
              accent={FINGER_COLORS[selectedResult.summary.strongestFinger]}
            />
            <InfoCard
              label="Weakest Contributor"
              value={FINGER_NAMES[selectedResult.summary.weakestContributor]}
              accent={FINGER_COLORS[selectedResult.summary.weakestContributor]}
            />
            <InfoCard
              label="Biggest Fade"
              value={FINGER_NAMES[selectedResult.summary.biggestFadeFinger]}
              accent={FINGER_COLORS[selectedResult.summary.biggestFadeFinger]}
            />
            <InfoCard
              label="Takeover Finger"
              value={FINGER_NAMES[selectedResult.summary.takeoverFinger]}
              accent={FINGER_COLORS[selectedResult.summary.takeoverFinger]}
            />
            <InfoCard
              label="Most Stable Finger"
              value={FINGER_NAMES[selectedResult.summary.mostStableFinger]}
              accent={FINGER_COLORS[selectedResult.summary.mostStableFinger]}
            />
            <InfoCard
              label="Opposite Hand"
              value={oppositeResult ? `${oppositeResult.hand} ${bestPeakOfResult(oppositeResult).toFixed(1)} kg` : 'No saved opposite-hand result'}
              note={oppositeDelta === null ? 'Run the same protocol with the other hand to compare.' : `${formatSigned(oppositeDelta, 1, '%')} vs opposite hand`}
            />
          </div>
        </div>

        {bestAttempt && (
          <div className="bg-surface rounded-xl border border-border overflow-x-auto">
            <div className="px-4 pt-4">
              <div className="text-sm font-semibold">Best Attempt Finger Parameters</div>
              <div className="text-xs text-muted mt-1">
                Stored per-finger metrics from attempt #{selectedResult.summary.bestAttemptNo}.
              </div>
            </div>
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Finger</th>
                  <th className="px-3 py-2 text-right">Peak kg</th>
                  <th className="px-3 py-2 text-right">Share at Peak</th>
                  <th className="px-3 py-2 text-right">Drift</th>
                  <th className="px-3 py-2 text-right">Fatigue Slope</th>
                  <th className="px-3 py-2 text-right">Variability</th>
                  <th className="px-3 py-2 text-right">Under-recruited</th>
                </tr>
              </thead>
              <tbody>
                {FINGER_NAMES.map((finger, index) => (
                  <tr key={finger} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FINGER_COLORS[index] }} />
                        <span>{finger}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{bestAttempt.core.peakPerFingerKg[index].toFixed(1)} kg</td>
                    <td className="px-3 py-2 text-right tabular-nums">{bestAttempt.core.fingerShareAtPeakPct[index].toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatSigned(bestAttempt.coaching.contributionDriftPct[index], 1, '%')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatSigned(bestAttempt.coaching.fatigueSlopePerFingerKgS[index], 2, ' kg/s')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{bestAttempt.coaching.fingerVariabilityPct[index].toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{bestAttempt.coaching.underRecruitmentFlags[index] ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-surface rounded-xl border border-border overflow-x-auto">
          <div className="px-4 pt-4">
            <div className="text-sm font-semibold">Attempt Parameters</div>
            <div className="text-xs text-muted mt-1">
              Review the stored metrics for each attempt inside this test.
            </div>
          </div>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Attempt</th>
                <th className="px-3 py-2 text-right">Peak</th>
                <th className="px-3 py-2 text-right">Best 3s</th>
                <th className="px-3 py-2 text-right">Full Mean</th>
                <th className="px-3 py-2 text-right">Early-Late</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-right">Stability</th>
                <th className="px-3 py-2 text-right">Fatigue</th>
                <th className="px-3 py-2 text-right">RFD100</th>
              </tr>
            </thead>
            <tbody>
              {selectedResult.attempts.map(attempt => (
                <tr key={attempt.attemptNo} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{attempt.attemptNo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{attempt.core.peakTotalKg.toFixed(1)} kg</td>
                  <td className="px-3 py-2 text-right tabular-nums">{attempt.core.best3sMeanKg.toFixed(1)} kg</td>
                  <td className="px-3 py-2 text-right tabular-nums">{attempt.core.fullTestMeanKg.toFixed(1)} kg</td>
                  <td className="px-3 py-2 text-right tabular-nums">{attempt.core.earlyLateDropPct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{attempt.coaching.balanceScore.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.coaching.stabilityErrorPct, 1, '%')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.advanced?.fatigueIndex, 1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.advanced?.rfd100KgS, 0, ' kg/s')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(selectedResult.attempts.some(attempt => attempt.experimental || attempt.advanced) || safetyFlags.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
            <div className="bg-surface rounded-xl border border-border overflow-x-auto">
              <div className="px-4 pt-4">
                <div className="text-sm font-semibold">Advanced / Experimental Parameters</div>
                <div className="text-xs text-muted mt-1">
                  Extra stored analytics for fatigue, redistribution, synergy and explosive behavior.
                </div>
              </div>
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Attempt</th>
                    <th className="px-3 py-2 text-right">Redistribution</th>
                    <th className="px-3 py-2 text-right">Synergy</th>
                    <th className="px-3 py-2 text-right">RFD200</th>
                    <th className="px-3 py-2 text-right">Repeated Decay</th>
                    <th className="px-3 py-2 text-right">Final Third Mean</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResult.attempts.map(attempt => (
                    <tr key={attempt.attemptNo} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{attempt.attemptNo}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.advanced?.redistributionScore, 1)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.advanced?.fingerSynergyScore, 1)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.advanced?.rfd200KgS, 0, ' kg/s')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.experimental?.advancedFatigue?.repeatedEffortDecayPct, 1, '%')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNullable(attempt.experimental?.advancedFatigue?.finalThirdMeanPeakKg, 1, ' kg')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
              <div className="text-sm font-semibold">Safety / Notes</div>
              <InfoCard label="Confidence Core" value={selectedResult.confidence.core} />
              <InfoCard label="Confidence Coaching" value={selectedResult.confidence.coaching} />
              <InfoCard label="Confidence Experimental" value={selectedResult.confidence.experimental} />
              <InfoCard
                label="Safety Flags"
                value={safetyFlags.length === 0 ? 'None' : `${safetyFlags.length} flag${safetyFlags.length === 1 ? '' : 's'}`}
                note={safetyFlags.length === 0 ? 'No stored warning flags on this result.' : safetyFlags.join(', ')}
              />
              {selectedResult.sessionComparison && (
                <InfoCard
                  label="Previous Same-Test Delta"
                  value={selectedResult.sessionComparison.peakDeltaPct === null ? '--' : formatSigned(selectedResult.sessionComparison.peakDeltaPct, 1, '%')}
                  note="Peak change vs previous saved run of the same test."
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-1">{note}</div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
}) {
  return (
    <div className="bg-surface-alt rounded-lg border border-border p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-semibold mt-1" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {note && <div className="text-xs text-muted mt-1">{note}</div>}
    </div>
  );
}
