import { analyzeSession, type SessionPayload } from '@krimblokk/core';
import { useAppStore } from '../stores/appStore.ts';
import { useDeviceStore } from '../stores/deviceStore.ts';
import { useLiveStore } from '../stores/liveStore.ts';
import { useVerificationStore } from '../stores/verificationStore.ts';
import { toProfileSnapshot } from '../types/profile.ts';
import { defaultConnectedDevice } from '../device/deviceProfiles.ts';

export function sendTareCommand(statusMessage = 'Tare command sent'): void {
  void useDeviceStore.getState().tare();
  useDeviceStore.getState().addStatus(statusMessage);
}

export async function saveCurrentRecordingAsSession(): Promise<SessionPayload | null> {
  const live = useLiveStore.getState();
  const verification = useVerificationStore.getState().snapshot;
  const verificationReason = useVerificationStore.getState().blockReason;
  live.stopRecording();

  if ((verification.status === 'checking' || verification.status === 'critical') && verificationReason) {
    useLiveStore.getState().discardRecording();
    useDeviceStore.getState().addStatus(
      `Recording discarded: ${verificationReason}`,
    );
    return null;
  }

  if (live.recordedSamples.length < 2) {
    useDeviceStore.getState().addStatus('Recording discarded: not enough samples');
    return null;
  }

  const settings = useAppStore.getState().settings;
  const appHand = live.recordingHand ?? live.measurementHandOverride ?? useAppStore.getState().hand;
  const activeProfile = useAppStore.getState().profiles.find(
    profile => profile.profileId === useAppStore.getState().activeProfileId,
  ) ?? null;
  const deviceState = useDeviceStore.getState();
  const connectedDevice = deviceState.activeDevice ?? defaultConnectedDevice(deviceState.sourceKind);
  const sessionId = `session_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

  const { efforts, summary } = analyzeSession(
    live.recordedSamples,
    appHand,
    {
      startThresholdKg: settings.startThresholdKg,
      stopThresholdKg: settings.stopThresholdKg,
      startHoldMs: settings.startHoldMs,
      stopHoldMs: settings.stopHoldMs,
    },
    {
      tutThresholdKg: settings.tutThresholdKg,
      holdPeakFraction: settings.holdPeakFraction,
      stabilizationShiftThreshold: settings.stabilizationShiftThreshold,
      stabilizationHoldMs: settings.stabilizationHoldMs,
    },
    sessionId,
    live.recordingStartedIso ?? new Date().toISOString(),
  );

  const payload: SessionPayload = {
    sessionId,
    startedAtIso: live.recordingStartedIso ?? new Date().toISOString(),
    endedAtIso: new Date().toISOString(),
    hand: appHand,
    deviceType: connectedDevice.deviceType,
    deviceName: connectedDevice.deviceName,
    capabilities: connectedDevice.capabilities,
    sampleSource: connectedDevice.sourceKind,
    protocolVersion: 1,
    profile: activeProfile ? toProfileSnapshot(activeProfile) : null,
    tag: '',
    notes: '',
    summary,
    efforts,
    samples: live.recordedSamples.map(sample => ({ ...sample })),
  };

  await useAppStore.getState().saveSession(payload);
  useAppStore.getState().setCurrentSession(payload);
  useDeviceStore.getState().addStatus(`Session saved: ${sessionId}`);
  return payload;
}
