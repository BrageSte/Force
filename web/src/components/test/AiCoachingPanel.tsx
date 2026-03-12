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
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
          {report.focusAreas.map((focus) => (
            <div key={focus.id} className="bg-surface-alt rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold">{focus.title}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityClass(focus.priority)}`}>
                  {focus.priority}
                </span>
              </div>
              <div className="text-xs text-muted mt-2">{focus.summary}</div>
              <div className="text-xs text-text mt-3">{focus.action}</div>
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                {focus.evidence.map((line) => (
                  <div key={line} className="text-[11px] text-muted">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Next Recommended Test</div>
          <div className="text-base font-semibold mt-2">{report.nextStep.label}</div>
          <div className="text-xs text-muted mt-1">{report.nextStep.reason}</div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold mb-2">What Looks Good</div>
          <div className="space-y-2 text-xs text-muted">
            {report.positives.length > 0 ? (
              report.positives.map((item) => <div key={item}>{item}</div>)
            ) : (
              <div>No standout positive markers yet. Use the next test cycle to build a clearer baseline.</div>
            )}
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold mb-2">Coach Notes</div>
          <div className="space-y-2 text-xs text-muted">
            {report.watchouts.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
          <div className="text-[11px] text-muted mt-3 pt-3 border-t border-border">
            Prototype mode: coaching is generated locally from your metrics and history, so it is safe to extend with a real LLM later.
          </div>
        </div>
      </div>
    </div>
  );
}
