import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { calibrateFinger, serializeDeviceCommand, streamModeForInputMode, type DeviceCommand } from '@krimblokk/core';
import { FINGER_NAMES, channelIndexForFinger, channelNumberForFinger, displayOrder } from '../../constants/fingers.ts';
import { capabilitySummary } from '../../device/deviceProfiles.ts';
import { pipeline } from '../../pipeline/SamplePipeline.ts';
import { useSetupReadiness } from '../../setup/useSetupReadiness.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { useVerificationStore, verificationStatusBadge } from '../../stores/verificationStore.ts';
import type { InputMode, SmoothingMode, SourceKind } from '../../types/settings.ts';
import type { PageId } from '../layout/Sidebar.tsx';
import { FormRow } from '../shared/FormField.tsx';
import { Section } from '../shared/Section.tsx';
import { SetupChecklistCard } from '../shared/SetupChecklistCard.tsx';

interface SettingsPageProps {
  onNavigate?: (page: PageId) => void;
}

function sourceLabel(sourceKind: SourceKind): string {
  if (sourceKind === 'Serial') return 'GripSense Device via Web Serial';
  if (sourceKind === 'Simulator') return 'Simulator';
  if (sourceKind === 'Tindeq') return 'Tindeq Progressor';
  return sourceKind;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-2 text-sm font-semibold text-text">{value}</div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </div>
  );
}

function CollapsiblePanel({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-xl border border-border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">{title}</h3>
            <p className="mt-1 text-xs text-muted">{summary}</p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Collapsed</span>
        </div>
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const hand = useAppStore(s => s.hand);
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const statusMessages = useDeviceStore(s => s.statusMessages);
  const latestChannelRaw = useLiveStore(s => s.latestChannelRaw) ?? [0, 0, 0, 0];
  const latestMeasuredTotalKg = useLiveStore(s => s.latestMeasuredTotalKg);
  const tareRequired = useLiveStore(s => s.tareRequired);
  const verificationStatus = useVerificationStore(s => s.snapshot.status);
  const verificationReason = useVerificationStore(s => s.blockReason);
  const [knownKgInputs, setKnownKgInputs] = useState(['', '', '', '']);
  const { readinessReport, selectedDevice } = useSetupReadiness();

  const isRawMode = settings.inputMode === 'MODE_RAW';
  const activeStreamMode = useMemo(
    () => streamModeForInputMode(settings.inputMode),
    [settings.inputMode],
  );
  const fingerOrder = useMemo(() => displayOrder(hand), [hand]);
  const verificationBadge = useMemo(
    () => verificationStatusBadge(verificationStatus),
    [verificationStatus],
  );
  const calibrationMissing = settings.calibration.scales.some(scale => !Number.isFinite(scale) || scale <= 0);

  const rawSetupStatus = !selectedDevice.capabilities.perFingerForce
    ? 'Not required on total-force-only devices'
    : !isRawMode
      ? 'Handled by firmware in KG Direct'
      : tareRequired && calibrationMissing
        ? 'Tare and calibration needed'
        : tareRequired
          ? 'Tare required'
          : calibrationMissing
            ? 'Calibration incomplete'
            : 'Raw setup ready';

  const sendDeviceCommand = (command: DeviceCommand) => {
    const text = serializeDeviceCommand(command);
    void useDeviceStore.getState().sendDeviceCommand(command);
    useDeviceStore.getState().addStatus(`Sent: ${text}`);
  };

  const handleSettingsChange = (key: string, value: unknown) => {
    updateSettings({ [key]: value });
    if (key === 'inputMode' && connected) {
      const mode = streamModeForInputMode(value as InputMode);
      void useDeviceStore.getState().setInputMode(value as InputMode);
      useDeviceStore.getState().addStatus(`Requested ${mode.toUpperCase()} stream mode`);
    }
    pipeline.reconfigure();
  };

  const handleDeviceTare = () => {
    void useDeviceStore.getState().tare();
    useDeviceStore.getState().addStatus('Device tare requested from settings');
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
    <div className="h-full max-w-4xl overflow-auto">
      <div className="flex flex-col gap-6">
        <Section title="Device Setup">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Source"
              value={sourceLabel(sourceKind)}
              detail={connected ? `${selectedDevice.deviceLabel} is active.` : 'Connect in LIVE when you are ready.'}
            />
            <SummaryCard
              label="Input Mode"
              value={isRawMode ? 'Raw stream' : 'KG Direct'}
              detail={`Requested transport mode: ${activeStreamMode.toUpperCase()}`}
            />
            <div className="rounded-xl border border-border bg-surface-alt/70 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Verification</div>
              <div className="mt-2">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${verificationBadge.className}`}>
                  {verificationBadge.label}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted">
                {verificationReason ?? 'Verification messages appear here when the stream needs attention.'}
              </div>
            </div>
            <SummaryCard
              label="Tare / Calibration"
              value={rawSetupStatus}
              detail={selectedDevice.capabilities.perFingerForce ? capabilitySummary(selectedDevice.capabilities) : 'Tindeq stays total-force-only.'}
            />
          </div>

          <div className="mt-4">
            <SetupChecklistCard report={readinessReport} onNavigate={onNavigate} showWhenReady />
          </div>

          <div className="mt-4 rounded-xl border border-border bg-surface-alt/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text">Recovery Actions</div>
                <div className="mt-1 text-xs text-muted">
                  Keep source, verification and tare/calibration recovery explicit here so first-run and blocked states stay understandable.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDeviceTare}
                  disabled={!connected || !selectedDevice.capabilities.tare}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
                >
                  Device Tare
                </button>
                <button
                  onClick={() => handleSettingsChange('inputMode', 'MODE_KG_DIRECT')}
                  disabled={!connected}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
                >
                  Use KG Stream
                </button>
                <button
                  onClick={() => handleSettingsChange('inputMode', 'MODE_RAW')}
                  disabled={!connected || !selectedDevice.capabilities.perFingerForce}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
                >
                  Use Raw Stream
                </button>
                {isRawMode && selectedDevice.capabilities.perFingerForce && (
                  <button
                    onClick={handleRawTareAll}
                    disabled={!connected}
                    className="rounded-lg border border-primary/20 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-40"
                  >
                    Capture App Tare
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted">
            {isRawMode
              ? 'Raw mode is active. The device should stream counts, and web converts them using the offsets/scales below.'
              : 'KG Direct is active. The device or firmware owns tare and calibration, and web expects kilograms from the stream.'}
          </p>

          <div className="mt-3 rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs text-muted">
            Active stream request: <span className="font-semibold text-text">{activeStreamMode.toUpperCase()}</span>
            {latestMeasuredTotalKg > 0 && (
              <span>
                {' '}
                · Latest measured total: <span className="font-semibold text-text">{latestMeasuredTotalKg.toFixed(1)} kg</span>
              </span>
            )}
          </div>

          {isRawMode && selectedDevice.capabilities.perFingerForce && (
            <div className="mt-4 rounded-lg border border-border bg-bg px-3 py-3 text-xs text-muted">
              <div className="mb-2 font-medium text-text">App-side raw calibration</div>
              <div>Step 1: connect with no load and press `Capture App Tare`.</div>
              <div>Step 2: apply a known mass on one finger and press `Calibrate` on that finger.</div>
              <div className="mt-2">
                Current raw channels: {latestChannelRaw.map((value, index) => `CH${index + 1} ${value.toFixed(0)}`).join(' | ')}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {selectedDevice.capabilities.perFingerForce ? (
              fingerOrder.map(fingerIndex => {
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
                      onChange={event => handleKnownKgChange(fingerIndex, event.target.value)}
                      className="w-24 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
                    />
                    <div className="text-[11px] text-muted">
                      {isRawMode
                        ? `Offset ${settings.calibration.offsets[channelIndex].toFixed(1)} | Scale ${settings.calibration.scales[channelIndex].toExponential(3)}`
                        : `Firmware-side channel calibration on CH${channelNumber}`}
                    </div>
                    <button
                      onClick={() => handleCalibrationAction(fingerIndex)}
                      disabled={!connected}
                      className="rounded px-2 py-1 text-xs text-primary bg-primary/15 disabled:opacity-40"
                    >
                      Calibrate
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-border bg-bg px-3 py-3 text-xs text-muted">
                Per-channel tare and calibration are only shown for full FingerMap™ hardware. Total-force-only devices keep setup at the device level.
              </div>
            )}
          </div>
        </Section>

        <Section title="Effort Detection">
          <FormRow label="Start Threshold (kg)">
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={settings.startThresholdKg}
              onChange={event => handleSettingsChange('startThresholdKg', parseFloat(event.target.value))}
              className="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
            />
          </FormRow>
          <FormRow label="Stop Threshold (kg)">
            <input
              type="number"
              min={0.05}
              max={5}
              step={0.05}
              value={settings.stopThresholdKg}
              onChange={event => handleSettingsChange('stopThresholdKg', parseFloat(event.target.value))}
              className="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
            />
          </FormRow>
          <FormRow label="Start Hold (ms)">
            <input
              type="number"
              min={50}
              max={1000}
              step={50}
              value={settings.startHoldMs}
              onChange={event => handleSettingsChange('startHoldMs', parseInt(event.target.value))}
              className="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
            />
          </FormRow>
          <FormRow label="Stop Hold (ms)">
            <input
              type="number"
              min={100}
              max={2000}
              step={50}
              value={settings.stopHoldMs}
              onChange={event => handleSettingsChange('stopHoldMs', parseInt(event.target.value))}
              className="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
            />
          </FormRow>
        </Section>

        <Section title="Metrics">
          <FormRow label="AI Coaching">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.aiCoachingEnabled}
                onChange={event => handleSettingsChange('aiCoachingEnabled', event.target.checked)}
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
              onChange={event => handleSettingsChange('tutThresholdKg', parseFloat(event.target.value))}
              className="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
            />
          </FormRow>
          <FormRow label="Hold Peak Fraction">
            <input
              type="number"
              min={0.5}
              max={1}
              step={0.05}
              value={settings.holdPeakFraction}
              onChange={event => handleSettingsChange('holdPeakFraction', parseFloat(event.target.value))}
              className="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
            />
          </FormRow>
        </Section>

        <CollapsiblePanel
          title="Advanced · Signal & Debug"
          summary="Keep transport mode details, smoothing and the raw debug log available, but secondary to first-run setup and recovery."
        >
          <div className="space-y-4">
            <Section title="Signal Processing">
              <FormRow label="Input Mode">
                <select
                  value={settings.inputMode}
                  onChange={event => handleSettingsChange('inputMode', event.target.value as InputMode)}
                  className="rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
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
                  onChange={event => handleSettingsChange('smoothingMode', event.target.value as SmoothingMode)}
                  className="rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
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
                    min={0.01}
                    max={0.99}
                    step={0.05}
                    value={settings.smoothingAlpha}
                    onChange={event => handleSettingsChange('smoothingAlpha', parseFloat(event.target.value))}
                    className="w-20 rounded-lg border border-border bg-surface-alt px-2 py-1 text-sm text-text"
                  />
                </FormRow>
              )}
            </Section>

            <Section title="Debug Log">
              <div className="mb-3 flex justify-end">
                <button
                  onClick={() => useDeviceStore.getState().addStatus(`Current settings: ${JSON.stringify(settings)}`)}
                  className="rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-xs font-medium text-muted hover:text-text"
                >
                  Print Debug
                </button>
              </div>
              <div className="h-40 overflow-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs text-muted">
                {statusMessages.length === 0 && <span className="text-muted/50">No messages yet</span>}
                {statusMessages.map((message, index) => (
                  <div key={index}>{message}</div>
                ))}
              </div>
            </Section>
          </div>
        </CollapsiblePanel>
      </div>
    </div>
  );
}
