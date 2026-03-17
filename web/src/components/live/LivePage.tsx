import { useEffect, useRef } from 'react';
import { ConnectionPanel } from './ConnectionPanel.tsx';
import { QuickMeasurePanel } from './QuickMeasurePanel.tsx';
import { LiveFingerScene } from './LiveFingerScene.tsx';
import { LatestResultPanel } from './LatestResultPanel.tsx';

export function LivePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4 overflow-auto p-5">
      <ConnectionPanel />
      <QuickMeasurePanel />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <LiveFingerScene />
        <LatestResultPanel />
      </div>
    </div>
  );
}
