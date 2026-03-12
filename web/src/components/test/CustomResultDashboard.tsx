import { useMemo, useState } from 'react';
import { listResultWidgets, isResultWidgetAvailable, getResultWidget } from './resultWidgets.tsx';
import { resultWidgetLabel, testFamilyLabel } from './testConfig.ts';
import type { CompletedTestResult, ResultWidgetId } from './types.ts';

interface CustomResultDashboardProps {
  result: CompletedTestResult;
  history: CompletedTestResult[];
  oppositeHandResult: CompletedTestResult | null;
  sessionResults: CompletedTestResult[];
  onBackToLibrary: () => void;
}

function moveItem(list: ResultWidgetId[], fromIndex: number, toIndex: number): ResultWidgetId[] {
  if (toIndex < 0 || toIndex >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function CustomResultDashboard({
  result,
  history,
  oppositeHandResult,
  sessionResults,
  onBackToLibrary,
}: CustomResultDashboardProps) {
  const availableWidgets = listResultWidgets();
  const initialWidgets = result.dashboardSnapshot.resultWidgets.length > 0
    ? result.dashboardSnapshot.resultWidgets
    : (['summary'] as ResultWidgetId[]);
  const [selectedWidgets, setSelectedWidgets] = useState<ResultWidgetId[]>(initialWidgets);

  const sameTemplateHistory = useMemo(
    () => history.filter(item => item.templateId === result.templateId),
    [history, result.templateId],
  );

  const toggleWidget = (widgetId: ResultWidgetId) => {
    setSelectedWidgets(current =>
      current.includes(widgetId)
        ? current.filter(id => id !== widgetId)
        : [...current, widgetId],
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border p-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[220px]">
          <h2 className="text-lg font-semibold">{result.protocolName} Dashboard</h2>
          <p className="text-xs text-muted mt-1">
            {new Date(result.completedAtIso).toLocaleString()} · {result.hand} hand
            {result.templateVersion ? ` · Template v${result.templateVersion}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
              {testFamilyLabel(result.compareTags.family)}
            </span>
            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-surface-alt border border-border text-muted">
              {sameTemplateHistory.length} runs on this template
            </span>
          </div>
        </div>
        <button
          onClick={onBackToLibrary}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
        >
          New Test
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="text-sm font-semibold mb-3">Dashboard Picker</div>
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
          <div className="space-y-2">
            {availableWidgets.map(widget => {
              const available = isResultWidgetAvailable(widget.id, result);
              return (
                <label
                  key={widget.id}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                    available ? 'border-border bg-surface-alt' : 'border-border/60 bg-bg text-muted/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedWidgets.includes(widget.id)}
                    onChange={() => toggleWidget(widget.id)}
                    disabled={!available}
                    className="accent-blue-500 mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">{widget.label}</div>
                    <div className="text-xs text-muted">{widget.description}</div>
                    {!available && <div className="text-[11px] text-warning mt-1">Not available for this test</div>}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="space-y-2">
            {selectedWidgets.length === 0 ? (
              <div className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">
                Select at least one widget to build the dashboard for this result.
              </div>
            ) : (
              selectedWidgets.map((widgetId, index) => (
                <div key={widgetId} className="rounded-xl border border-border bg-bg p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{resultWidgetLabel(widgetId)}</div>
                    <div className="text-xs text-muted">Display order {index + 1}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedWidgets(current => moveItem(current, index, index - 1))}
                      disabled={index === 0}
                      className="px-2 py-1 rounded border border-border bg-surface-alt text-xs text-text disabled:opacity-30"
                    >
                      Up
                    </button>
                    <button
                      onClick={() => setSelectedWidgets(current => moveItem(current, index, index + 1))}
                      disabled={index === selectedWidgets.length - 1}
                      className="px-2 py-1 rounded border border-border bg-surface-alt text-xs text-text disabled:opacity-30"
                    >
                      Down
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {selectedWidgets.map(widgetId => {
          const widget = getResultWidget(widgetId);
          const available = widget.available(result);
          return (
            <section key={widgetId} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold">{widget.label}</h3>
                  <p className="text-xs text-muted mt-1">{widget.description}</p>
                </div>
                {!available && (
                  <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-warning/15 text-warning">
                    Not available
                  </span>
                )}
              </div>
              {available ? widget.render({ result, oppositeHandResult, sessionResults }) : (
                <div className="rounded-lg bg-surface-alt border border-border p-4 text-sm text-muted">
                  This widget is not available for the current result.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
