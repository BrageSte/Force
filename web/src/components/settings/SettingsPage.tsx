import { useMemo, useState } from 'react';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import type { SmoothingMode, InputMode } from '../../types/settings.ts';
import { pipeline } from '../../pipeline/SamplePipeline.ts';
import { FINGER_NAMES, channelIndexForFinger, channelNumberForFinger, displayOrder } from '../../constants/fingers.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { calibrateFinger, serializeDeviceCommand, streamModeForInputMode, type DeviceCommand } from '@krimblokk/core';
import { Section } from '../shared/Section.tsx';
import { FormRow } from '../shared/FormField.tsx';

export function SettingsPage() {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const hand = useAppStore(s => s.hand);
  const connected = useDeviceStore(s => s.connected);
  const statusMessages = useDeviceStore(s => s.statusMessages);
  const latestChannelRaw = useLiveStore(s => s.latestChannelRaw);
  const latestMeasuredTotalKg = useLiveStore(s => s.latestMeasuredTotalKg);
  const [knownKgInputs, setKnownKgInputs] = useState(['', '', '', '']);

  const isRawMode = settings.inputMode === 'MODE_RAW';
  const activeStreamMode = useMemo(
    () => streamModeForInputMode(settings.inputMode),
    [settings.inputMode],
  );
  const fingerOrder = useMemo(() => displayOrder(hand), [hand]);

  const sendDeviceCommand = (command: DeviceCommand) => {
    const text = serializeDeviceCommand(command);
    useDeviceStore.getState().sendDeviceCommand(command);
    useDeviceStore.getState().addStatus(`Sent: ${text}`);
  };

  const handleSettingsChange = (key: string, value: unknown) => {
    updateSettings({ [key]: value });
    if (key === 'inputMode' && connected) {
      const mode = streamModeForInputMode(value as InputMode);
      const source = useDeviceStore.getState().source;
      if (source?.setStreamMode) {
        source.setStreamMode(mode);
      } else {
        useDeviceStore.getState().sendCommand(`m ${mode}`);
      }
      useDeviceStore.getState().addStatus(`Requested ${mode.toUpperCase()} stream mode`);
    }
    pipeline.reconfigure();
  };

  const handleRawTareAll = () => {
    const nextCalibration = {
      offsets: [...latestChannelRaw],
      scales: [...settings.calibration.scales],
    };
    updateSettings({ calibration: nextCalibration });
    useDeviceStore.getState().addStatus('Captured app tare from current raw sample');
  };

  const handleKnownKgChange = (idx: number, value: string) => {
    setKnownKgInputs(current => current.map((entry, index) => (index === idx ? value : entry)));
  };

  const handleCalibrationAction = (idx: number) => {
    const channelIndex = channelIndexForFinger(hand, idx);
    const channelNumber = channelNumberForFinger(hand, idx);
    const knownKg = parseFloat(knownKgInputs[idx]);
    if (!Number.isFinite(knownKg) || knownKg <= 0) {
      useDeviceStore.getState().addStatus(`Calibration skipped for ${FINGER_NAMES[idx]}: known kg must be > 0`);
      return;
    }

    if (!isRawMode) {
      sendDeviceCommand({
        kind: 'calibrate_channel',
        channel: channelNumber,
        knownKg,
      });
      return;
    }

    try {
      const nextCalibration = calibrateFinger(
        settings.calibration,
        channelIndex,
        settings.calibration.offsets[channelIndex] ?? 0,
        latestChannelRaw[channelIndex],
        knownKg,
      );
      updateSettings({ calibration: nextCalibration });
      useDeviceStore.getState().addStatus(`App-side calibration updated for ${FINGER_NAMES[idx]} (CH${channelNumber})`);
    } catch (error) {
      useDeviceStore.getState().addStatus(
        `Calibration failed for ${FINGER_NAMES[idx]} (CH${channelNumber}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-auto max-w-2xl">
      {/* Calibration */}
      <Section title="Calibration">
        <p className="text-xs text-muted mb-3">
          {isRawMode
            ? 'Raw mode is active. The device should stream counts, and web converts them using the offsets/scales below.'
            : 'KG Direct is active. The device/firmware owns tare and calibration, and web expects kilograms from the stream.'}
        </p>
        <div className="mb-4 rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs text-muted">
          Active stream request: <span className="font-semibold text-text">{activeStreamMode.toUpperCase()}</span>
          {' '}| Live measured total: <span className="font-semibold text-text">{latestMeasuredTotalKg.toFixed(2)} kg</span>
        </div>
        <div className="mb-4 rounded-lg border border-border bg-bg px-3 py-3 text-xs text-muted">
          Active hand mapping:
          {' '}
          {fingerOrder.map(fingerIndex => `${FINGER_NAMES[fingerIndex]} = CH${channelNumberForFinger(hand, fingerIndex)}`).join(' | ')}
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => sendDeviceCommand({ kind: 'tare' })}
            disabled={!connected}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-text border border-border disabled:opacity-40"
          >
            Device Tare
          </button>
          <button
            onClick={() => sendDeviceCommand({ kind: 'print_debug' })}
            disabled={!connected}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-text border border-border disabled:opacity-40"
          >
            Print Debug
          </button>
          <button
            onClick={() => handleSettingsChange('inputMode', 'MODE_KG_DIRECT')}
            disabled={!connected}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-text border border-border disabled:opacity-40"
          >
            Use KG Stream
          </button>
          <button
            onClick={() => handleSettingsChange('inputMode', 'MODE_RAW')}
            disabled={!connected}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt text-text border border-border disabled:opacity-40"
          >
            Use Raw Stream
          </button>
          {isRawMode && (
            <button
              onClick={handleRawTareAll}
              disabled={!connected}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/20 disabled:opacity-40"
            >
              Capture App Tare
            </button>
          )}
        </div>

        {isRawMode && (
          <div className="mb-4 rounded-lg border border-border bg-bg px-3 py-3 text-xs text-muted">
            <div className="font-medium text-text mb-2">App-side raw calibration</div>
            <div>Step 1: connect with no load and press `Capture App Tare`.</div>
            <div>Step 2: apply a known mass on one finger and press `Calibrate` on that finger.</div>
            <div>
              Current raw channels:
              {' '}
              {latestChannelRaw.map((value, index) => `CH${index + 1} ${value.toFixed(0)}`).join(' | ')}
            </div>
          </div>
        )}

        {/* Per-channel calibration */}
        <div className="space-y-2">
          {fingerOrder.map((fingerIndex) => {
            const channelIndex = channelIndexForFinger(hand, fingerIndex);
            const channelNumber = channelIndex + 1;
            return (
            <div key={fingerIndex} className="grid grid-cols-[96px_96px_1fr_auto] items-center gap-3">
              <span className="text-xs text-muted">{FINGER_NAMES[fingerIndex]} (CH{channelNumber})</span>
              <input
                type="number"
                placeholder="Known kg"
                step="0.1"
                value={knownKgInputs[fingerIndex]}
                onChange={e => handleKnownKgChange(fingerIndex, e.target.value)}
                className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-24 text-text"
              />
              <div className="text-[11px] text-muted">
                {isRawMode
                  ? `Offset ${settings.calibration.offsets[channelIndex].toFixed(1)} | Scale ${settings.calibration.scales[channelIndex].toExponential(3)}`
                  : `Firmware-side channel calibration on CH${channelNumber}`}
              </div>
              <button
                onClick={() => handleCalibrationAction(fingerIndex)}
                disabled={!connected}
                className="px-2 py-1 rounded text-xs bg-primary/15 text-primary disabled:opacity-40"
              >
                Calibrate
              </button>
            </div>
            );
          })}
        </div>
      </Section>

      {/* Signal Processing */}
      <Section title="Signal Processing">
        <FormRow label="Input Mode">
          <select
            value={settings.inputMode}
            onChange={e => handleSettingsChange('inputMode', e.target.value as InputMode)}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm text-text"
          >
            <option value="MODE_KG_DIRECT">KG Direct</option>
            <option value="MODE_RAW">Raw (needs calibration)</option>
          </select>
        </FormRow>
        <div className="text-[11px] text-muted">
          `KG Direct` requests `m kg`. `Raw` requests `m raw` and applies `(raw - offset) * scale` in the web app.
        </div>
        <FormRow label="Smoothing">
          <select
            value={settings.smoothingMode}
            onChange={e => handleSettingsChange('smoothingMode', e.target.value as SmoothingMode)}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm text-text"
          >
            <option value="NONE">None</option>
            <option value="EMA">EMA</option>
            <option value="MOVING_AVG">Moving Average</option>
          </select>
        </FormRow>
        {settings.smoothingMode === 'EMA' && (
          <FormRow label="EMA Alpha">
            <input
              type="number"
              min={0.01} max={0.99} step={0.05}
              value={settings.smoothingAlpha}
              onChange={e => handleSettingsChange('smoothingAlpha', parseFloat(e.target.value))}
              className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-20 text-text"
            />
          </FormRow>
        )}
      </Section>

      {/* Segmentation */}
      <Section title="Effort Detection">
        <FormRow label="Start Threshold (kg)">
          <input
            type="number" min={0.1} max={5} step={0.1}
            value={settings.startThresholdKg}
            onChange={e => handleSettingsChange('startThresholdKg', parseFloat(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-20 text-text"
          />
        </FormRow>
        <FormRow label="Stop Threshold (kg)">
          <input
            type="number" min={0.05} max={5} step={0.05}
            value={settings.stopThresholdKg}
            onChange={e => handleSettingsChange('stopThresholdKg', parseFloat(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-20 text-text"
          />
        </FormRow>
        <FormRow label="Start Hold (ms)">
          <input
            type="number" min={50} max={1000} step={50}
            value={settings.startHoldMs}
            onChange={e => handleSettingsChange('startHoldMs', parseInt(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-20 text-text"
          />
        </FormRow>
        <FormRow label="Stop Hold (ms)">
          <input
            type="number" min={100} max={2000} step={50}
            value={settings.stopHoldMs}
            onChange={e => handleSettingsChange('stopHoldMs', parseInt(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-20 text-text"
          />
        </FormRow>
      </Section>

      {/* Metrics */}
      <Section title="Metrics">
        <FormRow label="AI Coaching">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.aiCoachingEnabled}
              onChange={e => handleSettingsChange('aiCoachingEnabled', e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-xs text-muted">Enable coaching summary after each test</span>
          </label>
        </FormRow>
        <FormRow label="TUT Threshold (kg)">
          <input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={settings.tutThresholdKg}
            onChange={e => handleSettingsChange('tutThresholdKg', parseFloat(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-20 text-text"
          />
        </FormRow>
        <FormRow label="Hold Peak Fraction">
          <input
            type="number"
            min={0.5}
            max={1}
            step={0.05}
            value={settings.holdPeakFraction}
            onChange={e => handleSettingsChange('holdPeakFraction', parseFloat(e.target.value))}
            className="bg-surface-alt border border-border rounded-lg px-2 py-1 text-sm w-20 text-text"
          />
        </FormRow>
      </Section>

      {/* Debug log */}
      <Section title="Debug Log">
        <div className="bg-bg rounded-lg border border-border p-3 h-40 overflow-auto font-mono text-xs text-muted">
          {statusMessages.length === 0 && <span className="text-muted/50">No messages yet</span>}
          {statusMessages.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </div>
      </Section>
    </div>
  );
}
