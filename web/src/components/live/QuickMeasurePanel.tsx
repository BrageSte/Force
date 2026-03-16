import { useEffect, useMemo } from 'react';
import { pipeline } from '../../pipeline/SamplePipeline.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import {
  QUICK_MEASURE_PRESETS,
  availableCustomDashboardMetrics,
  formatQuickCompletionReason,
  getQuickMeasureDefinition,
  normalizeCustomDashboardMetrics,
  quickMeasureBlockReason,
} from '../../live/quickMeasure.ts';

const PRESET_OUTPUTS: Record<string, string[]> = {
  live_monitor: [
    'Live total and per-finger monitoring',
    'Latest detected effort metrics',
    'No local quick-capture result',
  ],
  peak_total_pull: [
    'Peak total force',
    'Time to peak',
    'Short local capture only',
  ],
  peak_per_finger: [
    'Peak total force',
    'Peak per finger',
    'Peak share at top force',
  ],
  rfd_pull: [
    'Peak total force',
    'RFD100 and RFD200',
    'Time to peak',
  ],
  drift_hold_20s: [
    'Average hold force',
    'Total drift over time',
    'Finger contribution drift',
  ],
  stability_hold_20s: [
    'Average hold force',
    'Steadiness and stabilization time',
    'Per-finger variation when available',
  ],
  custom_dashboard: [
    'Choose which live metrics stay visible',
    'Live-only dashboard',
    'No local quick capture',
  ],
};

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function QuickMeasurePanel() {
  const hand = useAppStore(s => s.hand);
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const recording = useLiveStore(s => s.recording);
  const measurementHandOverride = useLiveStore(s => s.measurementHandOverride);
  const quickMeasurePresetId = useLiveStore(s => s.quickMeasurePresetId);
  const customDashboardMetrics = useLiveStore(s => s.customDashboardMetrics);
  const quickCapture = useLiveStore(s => s.quickCapture);
  const quickCaptureSamples = useLiveStore(s => s.quickCaptureSamples);
  const quickResult = useLiveStore(s => s.quickResult);
  const quickLivePeakTotalKg = useLiveStore(s => s.quickLivePeakTotalKg);
  const setQuickMeasurePreset = useLiveStore(s => s.setQuickMeasurePreset);
  const setCustomDashboardMetrics = useLiveStore(s => s.setCustomDashboardMetrics);
  const armQuickCapture = useLiveStore(s => s.armQuickCapture);
  const cancelQuickCapture = useLiveStore(s => s.cancelQuickCapture);
  const clearQuickMeasureRuntime = useLiveStore(s => s.clearQuickMeasureRuntime);

  const device = activeDevice ?? defaultConnectedDevice(sourceKind);
  const activePreset = getQuickMeasureDefinition(quickMeasurePresetId);
  const blockReason = quickMeasureBlockReason(activePreset, device.capabilities);
  const availableMetrics = useMemo(
    () => availableCustomDashboardMetrics(device.capabilities),
    [device.capabilities],
  );

  useEffect(() => {
    const normalized = normalizeCustomDashboardMetrics(customDashboardMetrics, device.capabilities);
    if (!arraysEqual(customDashboardMetrics, normalized)) {
      setCustomDashboardMetrics(normalized);
    }
  }, [customDashboardMetrics, device.capabilities, setCustomDashboardMetrics]);

  const selectedHand = measurementHandOverride ?? hand;
  const elapsedCaptureMs = quickCapture.status === 'capturing' && quickCapture.startedAtMs !== null && quickCaptureSamples.length > 0
    ? quickCaptureSamples[quickCaptureSamples.length - 1].tMs - quickCapture.startedAtMs
    : 0;

  const handlePresetSelect = (presetId: typeof quickMeasurePresetId) => {
    setQuickMeasurePreset(presetId);
  };

  const handleCaptureAction = () => {
    if (quickCapture.status === 'capturing') {
      pipeline.stopQuickCapture('manual_stop');
      return;
    }

    if (quickCapture.status === 'armed') {
      cancelQuickCapture();
      useDeviceStore.getState().addStatus('Quick capture cancelled');
      return;
    }

    armQuickCapture(activePreset.id, selectedHand);
    useDeviceStore.getState().addStatus(
      activePreset.captureMode === 'timed_hold'
        ? `Quick capture armed: next 20-second hold for ${selectedHand}`
        : `Quick capture armed: next pull for ${selectedHand}`,
    );
  };

  const handleClear = () => {
    clearQuickMeasureRuntime({ preservePreset: true });
    useDeviceStore.getState().addStatus('Quick measure cleared');
  };

  const captureDisabled = !connected || recording || blockReason !== null;
  const captureButtonLabel = quickCapture.status === 'capturing'
    ? 'Stop Capture'
    : quickCapture.status === 'armed'
      ? 'Cancel'
      : 'Arm Quick Capture';
  const canCapture = activePreset.captureMode === 'single_effort' || activePreset.captureMode === 'timed_hold';
  const hasQuickState = quickResult !== null || quickLivePeakTotalKg > 0 || quickCapture.status !== 'idle';

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-muted uppercase tracking-wide">Quick Measure</div>
          <div className="text-lg font-semibold mt-1">Rapid live checks and short local captures</div>
          <p className="text-sm text-muted mt-2 max-w-3xl">
            `LIVE` is for fast checks, one-off pulls, and short local measurements. Use `TEST` for formal benchmark protocols and serious tracking over time.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs text-muted">
          Active hand: <span className="font-semibold text-text">{selectedHand}</span>
          <div className="mt-1">Quick captures stay local to `LIVE` and are not saved to History.</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_MEASURE_PRESETS.map(preset => {
          const unavailable = quickMeasureBlockReason(preset, device.capabilities) !== null;
          const selected = preset.id === quickMeasurePresetId;
          return (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : unavailable
                    ? 'border-border bg-surface-alt text-muted'
                    : 'border-border bg-surface-alt text-text hover:border-primary/30'
              }`}
            >
              <div className="font-semibold">{preset.label}</div>
              <div className="text-[11px] mt-1 opacity-80">
                {preset.captureMode === 'timed_hold'
                  ? '20s auto-stop'
                  : preset.captureMode === 'single_effort'
                    ? 'One pull'
                    : preset.captureMode === 'custom_dashboard'
                      ? 'Live-only'
                      : 'Monitor'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="rounded-xl border border-border bg-surface-alt/60 p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-base font-semibold">{activePreset.label}</div>
              {blockReason && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-warning/15 text-warning border border-warning/30">
                  Native per-finger only
                </span>
              )}
            </div>
            <p className="text-sm text-muted mt-2">{activePreset.description}</p>
            <p className="text-xs text-muted mt-2">{activePreset.helperText}</p>
          </div>

          {blockReason && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
              {blockReason}
            </div>
          )}

          {activePreset.id === 'custom_dashboard' ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold">Visible live metrics</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableMetrics.map(metric => {
                  const checked = customDashboardMetrics.includes(metric.id);
                  return (
                    <label
                      key={metric.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? customDashboardMetrics.filter(item => item !== metric.id)
                            : [...customDashboardMetrics, metric.id];
                          setCustomDashboardMetrics(next);
                        }}
                        className="mt-0.5 accent-blue-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-text">{metric.label}</span>
                        <span className="block text-xs text-muted mt-1">{metric.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : canCapture ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCaptureAction}
                disabled={captureDisabled}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  quickCapture.status === 'capturing'
                    ? 'bg-danger text-white hover:bg-danger/80'
                    : 'bg-primary text-white hover:bg-primary-hover'
                } disabled:opacity-30`}
              >
                {captureButtonLabel}
              </button>
              <button
                onClick={handleClear}
                disabled={!hasQuickState}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text disabled:opacity-30"
              >
                Clear
              </button>
              <div className="text-xs text-muted">
                {recording
                  ? 'Stop session recording before arming a quick capture.'
                  : quickCapture.status === 'armed'
                    ? activePreset.captureMode === 'timed_hold'
                      ? 'Armed and waiting for the next effort to start a 20-second hold capture.'
                      : 'Armed and waiting for the next pull.'
                    : quickCapture.status === 'capturing'
                      ? activePreset.captureMode === 'timed_hold'
                        ? `Capturing ${Math.max(0, elapsedCaptureMs / 1000).toFixed(1)} / 20.0s`
                        : 'Capturing the current pull.'
                      : 'Local-only capture. Nothing is stored to Sessions or TEST.'}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="rounded-lg border border-border bg-surface px-3 py-3 text-sm text-muted flex-1 min-w-[220px]">
                This preset stays in monitor mode and does not create a local quick-capture result.
              </div>
              <button
                onClick={handleClear}
                disabled={!hasQuickState}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-text disabled:opacity-30"
              >
                Clear
              </button>
            </div>
          )}

          {quickResult && quickResult.presetId === activePreset.id && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm text-success">
              {formatQuickCompletionReason(quickResult.completionReason)} at {new Date(quickResult.capturedAtIso).toLocaleTimeString()}.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface-alt/60 p-4">
          <div className="text-xs text-muted uppercase tracking-wide">Active Outputs</div>
          <div className="space-y-2 mt-3">
            {(PRESET_OUTPUTS[activePreset.id] ?? []).map(output => (
              <div key={output} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text">
                {output}
              </div>
            ))}
          </div>
          {quickResult && quickResult.presetId === activePreset.id && (
            <div className="mt-4 rounded-lg border border-border bg-surface px-3 py-3 text-xs text-muted">
              Last capture: {quickResult.durationS.toFixed(1)}s · {quickResult.sampleCount} samples
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
