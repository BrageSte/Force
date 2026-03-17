import { useEffect, useState } from 'react';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { pipeline } from '../../pipeline/SamplePipeline.ts';
import type { SourceKind } from '../../types/settings.ts';
import { saveCurrentRecordingAsSession, sendTareCommand } from '../../live/sessionWorkflow.ts';
import { defaultConnectedDevice, capabilitySummary } from '../../device/deviceProfiles.ts';
import { DevicePickerModal } from '../device/DevicePickerModal.tsx';

function transportLabel(transport: string): string {
  if (transport === 'serial') return 'USB Serial';
  if (transport === 'simulator') return 'Simulator';
  return 'Bluetooth';
}

export function ConnectionPanel() {
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const connected = useDeviceStore(s => s.connected);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const recording = useLiveStore(s => s.recording);
  const quickCapture = useLiveStore(s => s.quickCapture);
  const tareRequired = useLiveStore(s => s.tareRequired);
  const measurementHandOverride = useLiveStore(s => s.measurementHandOverride);
  const setMeasurementHandOverride = useLiveStore(s => s.setMeasurementHandOverride);
  const hand = useAppStore(s => s.hand);
  const setHand = useAppStore(s => s.setHand);
  const preferredSource = useAppStore(s => s.settings.preferredSource);
  const updateSettings = useAppStore(s => s.updateSettings);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedDevice = activeDevice ?? defaultConnectedDevice(sourceKind);
  const selectedHand = measurementHandOverride ?? hand;

  useEffect(() => {
    if (!connected && sourceKind !== preferredSource) {
      useDeviceStore.getState().setSourceKind(preferredSource);
    }
  }, [connected, preferredSource, sourceKind]);

  const handleConnect = async () => {
    if (connected) {
      if (recording) {
        await handleStopRecording();
      }
      pipeline.disconnect();
      return;
    }

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

  const handleTare = () => {
    sendTareCommand();
  };

  const handleStartRecording = () => {
    if (recording) {
      void handleStopRecording();
      return;
    }

    const measurementHand = useLiveStore.getState().measurementHandOverride ?? hand;
    useLiveStore.getState().startRecording(measurementHand);
  };

  const handleStopRecording = async () => {
    pipeline.finalizeActiveEffort();
    await saveCurrentRecordingAsSession();
  };

  const handleHandChange = (nextHand: 'Left' | 'Right') => {
    setHand(nextHand);
    if (measurementHandOverride !== null) {
      setMeasurementHandOverride(nextHand);
    }
  };

  const connectButtonLabel = connected ? 'Disconnect' : 'Connect device';
  const connectionLabel = connected ? 'Connected' : 'Disconnected';
  const connectionDetail = selectedDevice.capabilities.perFingerForce
    ? 'Four-finger live scene ready when samples arrive.'
    : 'This device stays in total-force-only live mode.';
  const panelShellClass = connected
    ? 'overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)]'
    : 'sticky top-0 z-20 overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] backdrop-blur';

  return (
    <>
      <section className={panelShellClass}>
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.5fr)_320px]">
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-muted">Live</div>
              <h1 className="mt-2 text-2xl font-semibold text-text sm:text-3xl">
                Connect first, then keep each finger in view.
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-muted sm:text-base">
                Start here: choose the device you want to use, connect it, and keep `LIVE` focused on fast checks,
                short local captures, and four-finger monitoring on CURRENT_UNO_HX711.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleConnect}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  connected
                    ? 'bg-danger/15 text-danger hover:bg-danger/25'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {connectButtonLabel}
              </button>
              <button
                onClick={() => setPickerOpen(true)}
                disabled={connected}
                className="rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm font-medium text-text transition-colors disabled:opacity-40"
              >
                Change device
              </button>
              <div className="rounded-full border border-border bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text">
                {selectedDevice.deviceLabel}
              </div>
            </div>

            {!selectedDevice.capabilities.perFingerForce && (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                Full four-finger live monitoring stays native to CURRENT_UNO_HX711. {selectedDevice.deviceName} remains
                available here as a total-force-only device.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface-alt/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Connection Status</div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-text">{connectionLabel}</div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  connected
                    ? 'border border-success/30 bg-success/10 text-success'
                    : 'border border-border bg-surface text-muted'
                }`}
              >
                {transportLabel(selectedDevice.transport)}
              </span>
            </div>
            <div className="mt-2 text-sm text-muted">{connectionDetail}</div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Capabilities</span>
                <span className="text-right font-medium text-text">{capabilitySummary(selectedDevice.capabilities)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Selected device</span>
                <span className="text-right font-medium text-text">{selectedDevice.deviceName}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted">Primary use</span>
                <span className="text-right font-medium text-text">
                  {selectedDevice.capabilities.perFingerForce ? 'Per-finger live scene' : 'Total-force fallback'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-surface-alt/40 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-border bg-surface px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Measured Hand</div>
              <div className="mt-2 flex rounded-xl bg-surface-alt p-0.5">
                <button
                  onClick={() => handleHandChange('Left')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedHand === 'Left' ? 'bg-primary text-white' : 'text-muted hover:text-text'
                  }`}
                >
                  Left
                </button>
                <button
                  onClick={() => handleHandChange('Right')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedHand === 'Right' ? 'bg-primary text-white' : 'text-muted hover:text-text'
                  }`}
                >
                  Right
                </button>
              </div>
            </div>

            <button
              onClick={handleTare}
              disabled={!connected || !selectedDevice.capabilities.tare}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors disabled:opacity-30"
            >
              Tare
            </button>

            <button
              onClick={handleStartRecording}
              disabled={!connected || quickCapture.status !== 'idle'}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                recording
                  ? 'bg-danger text-white hover:bg-danger/80'
                  : 'border border-success/30 bg-success/15 text-success hover:bg-success/25'
              } disabled:opacity-30`}
            >
              {recording ? 'Stop & Save Session' : 'Record Session'}
            </button>

            {tareRequired && (
              <span className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger">
                Tare required
              </span>
            )}
          </div>

          {quickCapture.status !== 'idle' && (
            <div className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
              Stop or clear the active quick capture before starting a session recording.
            </div>
          )}
        </div>
      </section>

      <DevicePickerModal
        open={pickerOpen}
        selectedSourceKind={sourceKind}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSourceChange}
      />
    </>
  );
}
