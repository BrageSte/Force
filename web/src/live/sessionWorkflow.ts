import { analyzeSession, type SessionPayload } from '@krimblokk/core';
import { useAppStore } from '../stores/appStore.ts';
import { useDeviceStore } from '../stores/deviceStore.ts';
import { useLiveStore } from '../stores/liveStore.ts';
import { toProfileSnapshot } from '../types/profile.ts';

export function sendTareCommand(statusMessage = 'Tare command sent'): void {
  useDeviceStore.getState().sendDeviceCommand({ kind: 'tare' });
  useDeviceStore.getState().addStatus(statusMessage);
}

export async function saveCurrentRecordingAsSession(): Promise<SessionPayload | null> {
  const live = useLiveStore.getState();
  live.stopRecording();

  if (live.recordedSamples.length < 2) {
    useDeviceStore.getState().addStatus('Recording discarded: not enough samples');
    return null;
  }

  const settings = useAppStore.getState().settings;
  const appHand = useAppStore.getState().hand;
  const activeProfile = useAppStore.getState().profiles.find(
    profile => profile.profileId === useAppStore.getState().activeProfileId,
  ) ?? null;
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
    profile: activeProfile ? toProfileSnapshot(activeProfile) : null,
    tag: '',
    notes: '',
    summary,
    efforts,
    samples: live.recordedSamples.map(sample => ({
      tMs: sample.tMs,
      raw: sample.raw,
      kg: sample.kg,
      totalKg: sample.kg[0] + sample.kg[1] + sample.kg[2] + sample.kg[3],
    })),
  };

  await useAppStore.getState().saveSession(payload);
  useAppStore.getState().setCurrentSession(payload);
  useDeviceStore.getState().addStatus(`Session saved: ${sessionId}`);
  return payload;
}
