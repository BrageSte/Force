import { useLiveStore } from '../../stores/liveStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { ConnectionPanel } from './ConnectionPanel.tsx';
import { KpiStrip } from './KpiStrip.tsx';
import { ForceChart } from './ForceChart.tsx';
import { DistributionChart } from './DistributionChart.tsx';
import { EffortMetricsPanel } from './EffortMetricsPanel.tsx';
import { sendTareCommand } from '../../live/sessionWorkflow.ts';
import { capabilitySummary, defaultConnectedDevice } from '../../device/deviceProfiles.ts';

export function LivePage() {
  const latestTotalKg = useLiveStore(s => s.latestTotalKg);
  const tareRequired = useLiveStore(s => s.tareRequired);
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const device = activeDevice ?? defaultConnectedDevice(sourceKind);

  const handleTare = () => {
    sendTareCommand();
  };

  return (
    <div className="h-full flex flex-col gap-4 p-5 overflow-auto">
      {/* Row 1: Connection + Controls */}
      <ConnectionPanel />
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
        <span className="font-semibold text-text">{device.deviceLabel}</span>
        {' '}· {capabilitySummary(device.capabilities)}
      </div>

      {/* Row 2: KPI Cards */}
      <KpiStrip />

      {/* Row 3: Chart + Side panels */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 min-h-[360px]">
        {/* Force chart */}
        <div className="bg-surface rounded-xl border border-border p-3 overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <div className="text-xs text-muted uppercase tracking-wide">Live Force</div>
              <div className="text-lg font-semibold tabular-nums mt-1">{latestTotalKg.toFixed(1)} kg</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {tareRequired && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger/15 text-danger border border-danger/30">
                  Tare required
                </span>
              )}
              <button
                onClick={handleTare}
                disabled={!connected}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-alt border border-border text-text disabled:opacity-30"
              >
                Tare
              </button>
            </div>
          </div>
          <ForceChart />
        </div>

        {/* Side column */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          <DistributionChart />
          <EffortMetricsPanel />
        </div>
      </div>
    </div>
  );
}
