import { useEffect, useMemo, useState } from 'react';
import { pipeline } from '../../pipeline/SamplePipeline.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { defaultConnectedDevice } from '../../device/deviceProfiles.ts';
import type { SourceKind } from '../../types/settings.ts';
import { sendTareCommand } from '../../live/sessionWorkflow.ts';
import {
  QUICK_MEASURE_PRESETS,
  availableCustomDashboardMetrics,
  formatQuickCompletionReason,
  getQuickMeasureDefinition,
  normalizeCustomDashboardMetrics,
  quickMeasureBlockReason,
} from '../../live/quickMeasure.ts';
import { DevicePickerModal } from '../device/DevicePickerModal.tsx';

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function presetModeLabel(presetId: ReturnType<typeof getQuickMeasureDefinition>['id']): string {
  if (presetId === 'drift_hold_20s' || presetId === 'stability_hold_20s') return '20s auto-stop';
  if (presetId === 'peak_total_pull' || presetId === 'peak_per_finger' || presetId === 'rfd_pull') return 'One pull';
  if (presetId === 'custom_dashboard') return 'Live only';
  return 'Monitor';
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
  const updateSettings = useAppStore(s => s.updateSettings);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const handleConnect = async () => {
    const selectedSource = useDeviceStore.getState().sourceKind;

    try {
      await pipeline.connect();

      if (selectedSource === 'Serial') {
        const shouldTare = window.confirm('Serial connected. Tare with no load now?');
        if (shouldTare) {
          sendTareCommand('Auto tare command sent');
        }
      }
    } catch (err) {
      useDeviceStore.getState().addStatus(`Connection failed: ${String(err)}`);
      pipeline.disconnect();
    }
  };

  const handleSourceChange = (kind: SourceKind) => {
    if (connected) return;
    useDeviceStore.getState().setSourceKind(kind);
    updateSettings({ preferredSource: kind });
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

  const statusText = recording
    ? 'Stop session recording before arming a quick capture.'
    : quickCapture.status === 'armed'
      ? activePreset.captureMode === 'timed_hold'
        ? 'Armed and waiting for the next effort to start a 20-second hold capture.'
        : 'Armed and waiting for the next pull.'
      : quickCapture.status === 'capturing'
        ? activePreset.captureMode === 'timed_hold'
          ? `Capturing ${Math.max(0, elapsedCaptureMs / 1000).toFixed(1)} / 20.0s`
          : 'Capturing the current pull.'
        : activePreset.captureMode === 'custom_dashboard'
          ? 'Choose which live metrics stay visible in this quick-view mode.'
          : activePreset.captureMode === 'none'
            ? 'Monitor mode only. No local quick result is created until you pick a capture preset.'
            : 'Local-only capture. Nothing is stored to Sessions or TEST.';

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted">Quick Mode</div>
          <div className="mt-2 text-lg font-semibold text-text">Compact tabs for fast local checks and one-off captures</div>
        </div>
        <p className="max-w-xl text-sm text-muted">
          `LIVE` stays quick: switch presets here, keep only one active detail panel open, and leave formal benchmark
          tracking to `TEST`.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_MEASURE_PRESETS.map(preset => {
          const unavailable = quickMeasureBlockReason(preset, device.capabilities) !== null;
          const selected = preset.id === quickMeasurePresetId;
          return (
            <button
              key={preset.id}
              onClick={() => setQuickMeasurePreset(preset.id)}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : unavailable
                    ? 'border-border bg-surface-alt text-muted'
                    : 'border-border bg-surface-alt text-text hover:border-primary/30'
              }`}
            >
              <span>{preset.label}</span>
              <span className="ml-2 text-[11px] uppercase tracking-[0.14em] opacity-75">
                {presetModeLabel(preset.id)}
              </span>
            </button>
          );
        })}
      </div>

      {!connected && (
        <div className="mt-4 flex items-center gap-3 flex-wrap rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
          <div className="min-w-[220px] flex-1">
            <div className="text-sm font-semibold text-text">Device disconnected</div>
            <div className="mt-1 text-sm text-muted">
              Start here if the connection hero is out of view. Connect {device.deviceLabel} before arming quick capture.
            </div>
          </div>
          <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text">
            {device.deviceLabel}
          </div>
          <button
            onClick={handleConnect}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Connect device
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text"
          >
            Change device
          </button>
        </div>
      )}

      <section aria-label="Quick mode detail" className="mt-4 rounded-2xl border border-border bg-surface-alt/60 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-base font-semibold text-text">{activePreset.label}</div>
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted">
                {presetModeLabel(activePreset.id)}
              </span>
            </div>
            <p className="mt-2 text-sm text-text">{activePreset.description}</p>
            <p className="mt-2 text-xs text-muted">{activePreset.helperText}</p>
          </div>
          {blockReason && (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
              Native per-finger only
            </span>
          )}
        </div>

        {blockReason && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning">
            {blockReason}
          </div>
        )}

        {activePreset.id === 'custom_dashboard' && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Visible Live Metrics</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableMetrics.map(metric => {
                const checked = customDashboardMetrics.includes(metric.id);
                return (
                  <label
                    key={metric.id}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-text'
                    }`}
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
                      className="accent-blue-500"
                    />
                    <span>{metric.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {canCapture ? (
            <button
              onClick={handleCaptureAction}
              disabled={captureDisabled}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                quickCapture.status === 'capturing'
                  ? 'bg-danger text-white hover:bg-danger/80'
                  : 'bg-primary text-white hover:bg-primary-hover'
              } disabled:opacity-30`}
            >
              {captureButtonLabel}
            </button>
          ) : null}

          <button
            onClick={handleClear}
            disabled={!hasQuickState}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text disabled:opacity-30"
          >
            Clear
          </button>

          <div className="min-w-[220px] flex-1 text-sm text-muted">{statusText}</div>
        </div>

        {quickResult && quickResult.presetId === activePreset.id && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/10 px-3 py-3 text-sm text-success">
            {formatQuickCompletionReason(quickResult.completionReason)} at {new Date(quickResult.capturedAtIso).toLocaleTimeString()}.
          </div>
        )}
      </section>

      <DevicePickerModal
        open={pickerOpen}
        selectedSourceKind={sourceKind}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSourceChange}
      />
    </section>
  );
}
