import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { defaultConnectedDevice, capabilitySummary } from '../../device/deviceProfiles.ts';
import { useVerificationStore, verificationStatusBadge } from '../../stores/verificationStore.ts';
import { useDeviceConnectionControls } from '../../hooks/useDeviceConnectionControls.ts';
import { DevicePickerModal } from '../device/DevicePickerModal.tsx';

interface TopbarProps {
  onOpenProfilePage: () => void;
}

export function Topbar({ onOpenProfilePage }: TopbarProps) {
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const recording = useLiveStore(s => s.recording);
  const sampleRateHz = useLiveStore(s => s.sampleRateHz);
  const verificationStatus = useVerificationStore(s => s.snapshot.status);
  const profiles = useAppStore(s => s.profiles);
  const activeProfileId = useAppStore(s => s.activeProfileId);
  const setActiveProfile = useAppStore(s => s.setActiveProfile);
  const activeProfile = useAppStore(s => s.profiles.find(profile => profile.profileId === s.activeProfileId) ?? null);
  const {
    connected,
    pickerOpen,
    setPickerOpen,
    sourceKind,
    handleConnectToggle,
    handleSourceChange,
  } = useDeviceConnectionControls();
  const device = activeDevice ?? defaultConnectedDevice(sourceKind);
  const verificationBadge = verificationStatusBadge(verificationStatus);

  return (
    <>
      <header className="shrink-0 border-b border-border bg-surface px-5 py-2">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="mr-auto" />

          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-alt/70 px-2 py-1.5">
            <div className="hidden min-w-0 sm:block">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Device</div>
              <div className="max-w-[180px] truncate text-xs font-medium text-text">{device.deviceLabel}</div>
            </div>
            <button
              onClick={() => void handleConnectToggle()}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                connected
                  ? 'bg-danger/15 text-danger hover:bg-danger/25'
                  : 'bg-primary text-white hover:bg-primary-hover'
              }`}
            >
              {connected ? 'Disconnect' : 'Connect device'}
            </button>
            <button
              onClick={() => setPickerOpen(true)}
              disabled={connected}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors disabled:opacity-40"
            >
              Change device
            </button>
          </div>

          {activeProfile && (
            <div className="flex items-center gap-2 text-xs text-muted min-w-0">
              <span>Profile</span>
              <select
                value={activeProfileId}
                onChange={e => setActiveProfile(e.target.value)}
                className="min-w-[132px] max-w-[180px] rounded-lg border border-border bg-surface-alt px-2.5 py-1.5 text-xs text-text"
              >
                {profiles.map(profile => (
                  <option key={profile.profileId} value={profile.profileId}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <button
                onClick={onOpenProfilePage}
                className="rounded-lg border border-border bg-surface-alt px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text"
              >
                Profile
              </button>
            </div>
          )}

          <Chip
            label={connected ? `${device.deviceLabel} Connected` : 'Disconnected'}
            variant={connected ? 'success' : 'neutral'}
          />
          {connected && (
            <Chip label={capabilitySummary(device.capabilities)} variant="neutral" />
          )}
          {connected && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${verificationBadge.className}`}>
              {verificationBadge.label}
            </span>
          )}
          {connected && (verificationStatus === 'verified' || verificationStatus === 'warning') && (
            <Chip label={`${Math.round(sampleRateHz)} Hz`} variant="neutral" />
          )}
          {recording && (
            <Chip label="REC" variant="danger" pulse />
          )}
        </div>
      </header>

      <DevicePickerModal
        open={pickerOpen}
        selectedSourceKind={sourceKind}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSourceChange}
      />
    </>
  );
}

function Chip({ label, variant, pulse }: { label: string; variant: 'success' | 'danger' | 'neutral'; pulse?: boolean }) {
  const colors = {
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
    neutral: 'bg-surface-alt text-muted',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[variant]} ${pulse ? 'animate-pulse' : ''}`}>
      {label}
    </span>
  );
}
