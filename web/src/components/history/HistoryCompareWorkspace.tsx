import { useMemo, useState } from 'react';
import { FINGER_NAMES } from '../../constants/fingers.ts';
import type { Hand } from '../../types/force.ts';
import { compareMetricLabel, COMPARE_METRICS, getCompareMetric } from '../test/compareMetrics.ts';
import { testFamilyLabel } from '../test/testConfig.ts';
import { bestPeakOfResult } from '../test/testAnalysis.ts';
import type { CompareMetricId, CompletedTestResult } from '../test/types.ts';

interface HistoryCompareWorkspaceProps {
  results: CompletedTestResult[];
}

type SourceScope = 'all' | 'builtin_family' | 'custom_template';

function chartPath(values: number[], width: number, height: number, minValue: number, maxValue: number): string {
  if (values.length === 0) return '';
  const span = Math.max(1e-6, maxValue - minValue);
  return values
    .map((value, index) => {
      const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - minValue) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function normalizeValue(result: CompletedTestResult, rawValue: number, normalize: boolean): number {
  if (!normalize) return rawValue;
  const bestPeak = bestPeakOfResult(result);
  if (bestPeak <= 1e-9) return rawValue;
  return (rawValue / bestPeak) * 100;
}

export function HistoryCompareWorkspace({ results }: HistoryCompareWorkspaceProps) {
  const [metricId, setMetricId] = useState<CompareMetricId>('best_peak_total_kg');
  const [fingerIdx, setFingerIdx] = useState(0);
  const [sourceScope, setSourceScope] = useState<SourceScope>('all');
  const [sourceValue, setSourceValue] = useState<string>('all');
  const [handFilter, setHandFilter] = useState<'all' | Hand>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoNormalize, setAutoNormalize] = useState(false);
  const [limit, setLimit] = useState(20);

  const metric = useMemo(() => getCompareMetric(metricId), [metricId]);
  const builtinFamilies = useMemo(
    () => Array.from(new Set(results.filter(result => result.protocolKind === 'builtin').map(result => result.compareTags.family))),
    [results],
  );
  const customTemplates = useMemo(() => {
    const map = new Map<string, string>();
    for (const result of results) {
      if (result.templateId) {
        map.set(result.templateId, result.templateName ?? result.protocolName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [results]);

  const normalizationAvailable = metric.normalization === 'kg';

  const filteredResults = useMemo(() => {
    const lowerBound = startDate ? new Date(startDate).getTime() : Number.NEGATIVE_INFINITY;
    const upperBound = endDate ? new Date(`${endDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    const filtered = results.filter(result => {
      const completedAt = new Date(result.completedAtIso).getTime();
      if (completedAt < lowerBound || completedAt > upperBound) return false;
      if (handFilter !== 'all' && result.hand !== handFilter) return false;
      if (sourceScope === 'builtin_family' && result.compareTags.family !== sourceValue) return false;
      if (sourceScope === 'custom_template' && result.templateId !== sourceValue) return false;
      return metric.available(result);
    });

    return filtered
      .sort((a, b) => a.completedAtIso.localeCompare(b.completedAtIso))
      .slice(-Math.max(1, limit));
  }, [endDate, handFilter, limit, metric, results, sourceScope, sourceValue, startDate]);

  const series = useMemo(() => {
    return filteredResults
      .map(result => {
        const rawValue = metric.getValue(result, metric.requiresFinger ? fingerIdx : undefined);
        if (rawValue === null) return null;
        return {
          result,
          rawValue,
          displayValue: normalizeValue(result, rawValue, autoNormalize && normalizationAvailable),
        };
      })
      .filter((item): item is { result: CompletedTestResult; rawValue: number; displayValue: number } => item !== null);
  }, [autoNormalize, filteredResults, fingerIdx, metric, normalizationAvailable]);

  const chartValues = series.map(item => item.displayValue);
  const minValue = chartValues.length > 0 ? Math.min(...chartValues) : 0;
  const maxValue = chartValues.length > 0 ? Math.max(...chartValues) : 1;
  const chartMin = autoNormalize && normalizationAvailable ? Math.min(0, minValue * 0.95) : minValue - Math.max(1, Math.abs(maxValue - minValue) * 0.1);
  const chartMax = autoNormalize && normalizationAvailable ? Math.max(100, maxValue * 1.05) : maxValue + Math.max(1, Math.abs(maxValue - minValue) * 0.1);
  const chartHeight = 240;
  const chartWidth = 760;

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="text-sm font-semibold mb-3">Compare</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <FormField label="Metric">
            <select
              value={metricId}
              onChange={e => setMetricId(e.target.value as CompareMetricId)}
              className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
            >
              {COMPARE_METRICS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </FormField>

          {metric.requiresFinger && (
            <FormField label="Finger">
              <select
                value={fingerIdx}
                onChange={e => setFingerIdx(Number(e.target.value))}
                className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
              >
                {FINGER_NAMES.map((name, index) => (
                  <option key={name} value={index}>{name}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Source scope">
            <select
              value={sourceScope}
              onChange={e => {
                const nextScope = e.target.value as SourceScope;
                setSourceScope(nextScope);
                setSourceValue(nextScope === 'all' ? 'all' : '');
              }}
              className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
            >
              <option value="all">All tests</option>
              <option value="builtin_family">Built-in family</option>
              <option value="custom_template">Custom template</option>
            </select>
          </FormField>

          {sourceScope === 'builtin_family' && (
            <FormField label="Built-in family">
              <select
                value={sourceValue}
                onChange={e => setSourceValue(e.target.value)}
                className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
              >
                <option value="">Select family</option>
                {builtinFamilies.map(family => (
                  <option key={family} value={family}>{testFamilyLabel(family)}</option>
                ))}
              </select>
            </FormField>
          )}

          {sourceScope === 'custom_template' && (
            <FormField label="Custom template">
              <select
                value={sourceValue}
                onChange={e => setSourceValue(e.target.value)}
                className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
              >
                <option value="">Select template</option>
                {customTemplates.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Hand">
            <select
              value={handFilter}
              onChange={e => setHandFilter(e.target.value as 'all' | Hand)}
              className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
            >
              <option value="all">Both hands</option>
              <option value="Left">Left</option>
              <option value="Right">Right</option>
            </select>
          </FormField>

          <FormField label="Start date">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
            />
          </FormField>

          <FormField label="End date">
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
            />
          </FormField>

          <FormField label="Recent results limit">
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text w-full"
            />
          </FormField>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            normalizationAvailable ? 'border-border bg-surface-alt' : 'border-border/60 bg-bg text-muted'
          }`}>
            <input
              type="checkbox"
              checked={autoNormalize}
              onChange={e => setAutoNormalize(e.target.checked)}
              disabled={!normalizationAvailable}
              className="accent-blue-500"
            />
            <span>Auto normalize</span>
          </label>
          <span className="text-xs text-muted">{metric.description}</span>
        </div>

        {autoNormalize && normalizationAvailable && (
          <div className="mt-3 rounded-lg bg-warning/10 border border-warning/30 p-3 text-xs text-warning">
            Auto normalized comparison. Values are shown as a percentage of each run&apos;s best peak, so this is an autogenerated comparison layer.
          </div>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold">{compareMetricLabel(metricId, metric.requiresFinger ? fingerIdx : null)}</div>
            <div className="text-xs text-muted mt-1">
              {series.length} result{series.length === 1 ? '' : 's'} in view
            </div>
          </div>
          <div className="text-xs text-muted">
            Unit: {autoNormalize && normalizationAvailable ? '% of best peak' : metric.unit}
          </div>
        </div>

        {series.length === 0 ? (
          <div className="rounded-lg bg-bg border border-border p-6 text-sm text-muted">
            No results match the current metric and filters.
          </div>
        ) : (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-[240px] rounded-lg bg-bg border border-border">
            <polyline
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.5"
              points={chartPath(chartValues, chartWidth, chartHeight, chartMin, chartMax)}
            />
            {chartValues.map((value, index) => {
              const x = chartValues.length <= 1 ? chartWidth / 2 : (index / (chartValues.length - 1)) * chartWidth;
              const y = chartHeight - ((value - chartMin) / Math.max(1e-6, chartMax - chartMin)) * chartHeight;
              return <circle key={series[index].result.resultId} cx={x} cy={y} r="4" fill="#60a5fa" />;
            })}
          </svg>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-alt text-muted text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Test</th>
              <th className="px-3 py-2 text-left">Hand</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2 text-right">Raw</th>
            </tr>
          </thead>
          <tbody>
            {series.map(item => (
              <tr key={item.result.resultId} className="border-t border-border">
                <td className="px-3 py-2 text-muted">
                  {new Date(item.result.completedAtIso).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2">
                  {item.result.templateName ?? item.result.protocolName}
                </td>
                <td className="px-3 py-2 text-muted">{item.result.hand}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {item.displayValue.toFixed(1)} {autoNormalize && normalizationAvailable ? '%' : metric.unit}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">
                  {item.rawValue.toFixed(1)} {metric.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
