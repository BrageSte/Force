import { useEffect, useState } from 'react';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { pipeline } from '../../pipeline/SamplePipeline.ts';
import type { SourceKind } from '../../types/settings.ts';
import { saveCurrentRecordingAsSession, sendTareCommand } from '../../live/sessionWorkflow.ts';
import { defaultConnectedDevice, capabilitySummary } from '../../device/deviceProfiles.ts';
import { DevicePickerModal } from '../device/DevicePickerModal.tsx';

export function ConnectionPanel() {
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const connected = useDeviceStore(s => s.connected);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const recording = useLiveStore(s => s.recording);
  const hand = useAppStore(s => s.hand);
  const setHand = useAppStore(s => s.setHand);
  const preferredSource = useAppStore(s => s.settings.preferredSource);
  const updateSettings = useAppStore(s => s.updateSettings);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedDevice = activeDevice ?? defaultConnectedDevice(sourceKind);

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
    } else {
      const measurementHand = useLiveStore.getState().measurementHandOverride ?? hand;
      useLiveStore.getState().startRecording(measurementHand);
    }
  };

  const handleStopRecording = async () => {
    pipeline.finalizeActiveEffort();
    await saveCurrentRecordingAsSession();
  };

  return (
    <>
      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
      {/* Source + Connect */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setPickerOpen(true)}
          disabled={connected}
          className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text disabled:opacity-40"
        >
          {selectedDevice.deviceLabel}
        </button>
        <div className="text-xs text-muted">
          {capabilitySummary(selectedDevice.capabilities)}
        </div>
        <button
          onClick={handleConnect}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            connected
              ? 'bg-danger/15 text-danger hover:bg-danger/25'
              : 'bg-primary text-white hover:bg-primary-hover'
          }`}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Hand + Tare + Record */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-surface-alt rounded-lg p-0.5">
          <button
            onClick={() => setHand('Left')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              hand === 'Left' ? 'bg-primary text-white' : 'text-muted hover:text-text'
            }`}
          >
            Left
          </button>
          <button
            onClick={() => setHand('Right')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              hand === 'Right' ? 'bg-primary text-white' : 'text-muted hover:text-text'
            }`}
          >
            Right
          </button>
        </div>

        <button
          onClick={handleTare}
          disabled={!connected || !selectedDevice.capabilities.tare}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-muted hover:text-text border border-border disabled:opacity-30 transition-colors"
        >
          Tare
        </button>

        <div className="flex-1" />

        <button
          onClick={handleStartRecording}
          disabled={!connected}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            recording
              ? 'bg-danger text-white hover:bg-danger/80'
              : 'bg-success/15 text-success hover:bg-success/25 border border-success/30'
          } disabled:opacity-30`}
        >
          {recording ? 'Stop & Save' : 'Record'}
        </button>
      </div>
      </div>
      <DevicePickerModal
        open={pickerOpen}
        selectedSourceKind={sourceKind}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSourceChange}
      />
    </>
  );
}
