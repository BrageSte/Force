import type { ReactNode } from 'react';
import type { SetupChecklistTarget, SetupReadinessReport } from '../../setup/setupReadiness.ts';

interface SetupChecklistCardProps {
  report: SetupReadinessReport;
  onNavigate?: (target: SetupChecklistTarget) => void;
  compact?: boolean;
  showWhenReady?: boolean;
  maxItems?: number;
  heading?: string;
  footer?: ReactNode;
}

function toneClasses(tone: 'info' | 'warning' | 'danger'): string {
  if (tone === 'danger') return 'border-danger/30 bg-danger/10 text-danger';
  if (tone === 'warning') return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-primary/20 bg-primary/10 text-primary';
}

function toneLabel(tone: 'info' | 'warning' | 'danger'): string {
  if (tone === 'danger') return 'Blocked';
  if (tone === 'warning') return 'Needs attention';
  return 'In progress';
}

export function SetupChecklistCard({
  report,
  onNavigate,
  compact = false,
  showWhenReady = false,
  maxItems,
  heading = 'Setup checklist',
  footer,
}: SetupChecklistCardProps) {
  if (report.ready && !showWhenReady) return null;

  const visibleItems = maxItems ? report.items.slice(0, maxItems) : report.items;

  return (
    <section
      aria-label="Setup checklist"
      className={`rounded-2xl border border-border bg-surface ${compact ? 'px-4 py-4' : 'px-5 py-5'} shadow-[0_18px_45px_-42px_rgba(15,23,42,0.65)]`}
    >
      <div className={`flex ${compact ? 'flex-col gap-3' : 'items-start justify-between gap-4 flex-wrap'}`}>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted">{heading}</div>
          <h3 className={`${compact ? 'mt-1 text-base' : 'mt-1 text-lg'} font-semibold text-text`}>{report.title}</h3>
          <p className="mt-1 text-sm text-muted">{report.summary}</p>
        </div>
        {report.ready && (
          <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            Ready
          </span>
        )}
      </div>

      {!report.ready && (
        <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {visibleItems.map(item => (
            <div key={item.state} className="rounded-xl border border-border bg-surface-alt/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-text">{item.title}</div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses(item.tone)}`}>
                  {toneLabel(item.tone)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{item.summary}</p>
              <button
                onClick={() => onNavigate?.(item.ctaTarget)}
                className="mt-3 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-surface-alt"
              >
                {item.ctaLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {footer ? <div className="mt-4">{footer}</div> : null}
    </section>
  );
}
