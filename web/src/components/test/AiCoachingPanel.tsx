import { useState } from 'react';
import type { AiCoachingReport } from './aiCoaching.ts';

interface AiCoachingPanelProps {
  report: AiCoachingReport;
}

function priorityClass(priority: string): string {
  if (priority === 'High') return 'bg-danger/15 text-danger border border-danger/30';
  if (priority === 'Medium') return 'bg-warning/15 text-warning border border-warning/30';
  return 'bg-success/15 text-success border border-success/30';
}

function confidenceClass(confidence: string): string {
  return confidence === 'Moderate'
    ? 'bg-warning/15 text-warning'
    : 'bg-danger/15 text-danger';
}

export function AiCoachingPanel({ report }: AiCoachingPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const extraFocusAreas = report.focusAreas.slice(1);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="text-sm font-semibold">AI Coaching</div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
            ACTIVE
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${confidenceClass(report.confidence)}`}>
            {report.confidence} confidence
          </span>
        </div>

        <div className="text-lg font-semibold leading-tight">{report.headline}</div>
        <div className="text-xs text-muted mt-1">{report.overview}</div>
        {report.trendNote && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-3 text-sm text-text">
            {report.trendNote}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-surface-alt p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Primary Insight</div>
              <div className="mt-1 text-base font-semibold">{report.primaryInsight.title}</div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityClass(report.primaryInsight.priority)}`}>
              {report.primaryInsight.priority}
            </span>
          </div>
          <div className="mt-2 text-sm text-muted">{report.primaryInsight.summary}</div>
          <div className="mt-3 text-sm text-text">{report.primaryInsight.action}</div>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {report.primaryInsight.evidence.map((line) => (
              <div key={line} className="text-[11px] text-muted">
                {line}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowDetails(current => !current)}
          className="mt-4 rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs font-medium text-text"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>

        {showDetails && (
          <div className="mt-4 space-y-4">
            {extraFocusAreas.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {extraFocusAreas.map((focus) => (
                  <div key={focus.id} className="bg-surface-alt rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold">{focus.title}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityClass(focus.priority)}`}>
                        {focus.priority}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-2">{focus.summary}</div>
                    <div className="text-xs text-text mt-3">{focus.action}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-surface-alt rounded-xl border border-border p-4">
                <div className="text-sm font-semibold mb-2">What Looks Good</div>
                <div className="space-y-2 text-xs text-muted">
                  {report.positives.length > 0 ? (
                    report.positives.map((item) => <div key={item}>{item}</div>)
                  ) : (
                    <div>No standout positive markers yet. Use the next cycle to build a clearer baseline.</div>
                  )}
                </div>
              </div>

              <div className="bg-surface-alt rounded-xl border border-border p-4">
                <div className="text-sm font-semibold mb-2">Coach Notes</div>
                <div className="space-y-2 text-xs text-muted">
                  {report.watchouts.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Recommended Next Step</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {report.recommendedAction.kind}
            </span>
            <div className="text-base font-semibold">{report.recommendedAction.label}</div>
          </div>
          <div className="text-xs text-muted mt-1">{report.recommendedAction.reason}</div>
          <div className="text-[11px] text-muted mt-3 pt-3 border-t border-border">
            Coaching stays deterministic and local. The recommendation points to the clearest next action without changing the underlying benchmark logic.
          </div>
        </div>
      </div>
    </div>
  );
}
