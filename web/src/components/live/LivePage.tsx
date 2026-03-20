import { useEffect, useRef } from 'react';
import { useSetupReadiness } from '../../setup/useSetupReadiness.ts';
import type { PageId } from '../layout/Sidebar.tsx';
import { SetupChecklistCard } from '../shared/SetupChecklistCard.tsx';
import { ConnectionPanel } from './ConnectionPanel.tsx';
import { QuickMeasurePanel } from './QuickMeasurePanel.tsx';
import { LiveFingerScene } from './LiveFingerScene.tsx';
import { LatestResultPanel } from './LatestResultPanel.tsx';

interface LivePageProps {
  onNavigate?: (page: PageId) => void;
}

export function LivePage({ onNavigate }: LivePageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { readinessReport } = useSetupReadiness();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4 overflow-auto p-5">
      <ConnectionPanel />
      {!readinessReport.ready && (
        <SetupChecklistCard
          report={readinessReport}
          compact
          maxItems={3}
          onNavigate={onNavigate}
          footer={
            <div className="rounded-xl border border-border bg-bg/70 px-3 py-2 text-xs text-muted">
              Keep `LIVE` as the quick-check surface. Use `PROFILE` for person basics, `SETTINGS` for device recovery and `TEST` for the first baseline benchmark.
            </div>
          }
        />
      )}
      <QuickMeasurePanel />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <LiveFingerScene />
        <LatestResultPanel />
      </div>
    </div>
  );
}
