import { useState } from 'react';
import { pipeline } from '../pipeline/SamplePipeline.ts';
import { saveCurrentRecordingAsSession, sendTareCommand } from '../live/sessionWorkflow.ts';
import { useAppStore } from '../stores/appStore.ts';
import { useDeviceStore } from '../stores/deviceStore.ts';
import { useLiveStore } from '../stores/liveStore.ts';
import type { SourceKind } from '../types/settings.ts';

export function useDeviceConnectionControls() {
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const recording = useLiveStore(s => s.recording);
  const updateSettings = useAppStore(s => s.updateSettings);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleConnectToggle = async () => {
    if (connected) {
      if (recording) {
        pipeline.finalizeActiveEffort();
        await saveCurrentRecordingAsSession();
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

  return {
    connected,
    pickerOpen,
    setPickerOpen,
    sourceKind,
    handleConnectToggle,
    handleSourceChange,
  };
}
