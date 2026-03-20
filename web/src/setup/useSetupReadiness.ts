import { useMemo, useState } from 'react';
import { loadTestResults } from '../components/test/testStorage.ts';
import { defaultConnectedDevice } from '../device/deviceProfiles.ts';
import { useAppStore } from '../stores/appStore.ts';
import { useDeviceStore } from '../stores/deviceStore.ts';
import { useLiveStore } from '../stores/liveStore.ts';
import { useVerificationStore } from '../stores/verificationStore.ts';
import { deriveSetupReadiness } from './setupReadiness.ts';

export function useSetupReadiness() {
  const settings = useAppStore(s => s.settings);
  const activeProfile = useAppStore(s => s.profiles.find(profile => profile.profileId === s.activeProfileId) ?? null);
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const tareRequired = useLiveStore(s => s.tareRequired);
  const verificationStatus = useVerificationStore(s => s.snapshot.status);
  const verificationReason = useVerificationStore(s => s.blockReason);
  const [allTestResults, setAllTestResults] = useState(() => loadTestResults());

  const profileTestResults = useMemo(() => (
    activeProfile
      ? allTestResults
        .filter(result => result.profile?.profileId === activeProfile.profileId)
        .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))
      : []
  ), [activeProfile, allTestResults]);

  const selectedDevice = activeDevice ?? defaultConnectedDevice(sourceKind);

  const readinessReport = useMemo(() => deriveSetupReadiness({
    profile: activeProfile,
    testResults: profileTestResults,
    connected,
    deviceCapabilities: selectedDevice.capabilities,
    inputMode: settings.inputMode,
    sourceKind,
    verificationStatus,
    verificationReason,
    tareRequired,
    calibrationScales: settings.calibration.scales,
  }), [
    activeProfile,
    profileTestResults,
    connected,
    selectedDevice.capabilities,
    settings.inputMode,
    settings.calibration.scales,
    sourceKind,
    verificationStatus,
    verificationReason,
    tareRequired,
  ]);

  return {
    activeProfile,
    profileTestResults,
    readinessReport,
    selectedDevice,
    refreshTestResults: () => setAllTestResults(loadTestResults()),
  };
}
