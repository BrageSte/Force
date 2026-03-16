import { useDeviceStore } from '../../stores/deviceStore.ts';
import { useLiveStore } from '../../stores/liveStore.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { defaultConnectedDevice, capabilitySummary } from '../../device/deviceProfiles.ts';

interface TopbarProps {
  onOpenProfilePage: () => void;
}

export function Topbar({ onOpenProfilePage }: TopbarProps) {
  const connected = useDeviceStore(s => s.connected);
  const sourceKind = useDeviceStore(s => s.sourceKind);
  const activeDevice = useDeviceStore(s => s.activeDevice);
  const recording = useLiveStore(s => s.recording);
  const sampleRateHz = useLiveStore(s => s.sampleRateHz);
  const profiles = useAppStore(s => s.profiles);
  const activeProfileId = useAppStore(s => s.activeProfileId);
  const setActiveProfile = useAppStore(s => s.setActiveProfile);
  const activeProfile = useAppStore(s => s.profiles.find(profile => profile.profileId === s.activeProfileId) ?? null);
  const device = activeDevice ?? defaultConnectedDevice(sourceKind);

  return (
    <header className="h-12 shrink-0 bg-surface border-b border-border flex items-center px-5 gap-4">
      <div className="flex-1" />
      {activeProfile && (
        <div className="flex items-center gap-2 text-xs text-muted min-w-0">
          <span>Profile</span>
          <select
            value={activeProfileId}
            onChange={e => setActiveProfile(e.target.value)}
            className="bg-surface-alt border border-border rounded-lg px-2.5 py-1.5 text-xs text-text min-w-[132px] max-w-[180px]"
          >
            {profiles.map(profile => (
              <option key={profile.profileId} value={profile.profileId}>
                {profile.name}
              </option>
            ))}
          </select>
          <button
            onClick={onOpenProfilePage}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
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
        <Chip label={`${Math.round(sampleRateHz)} Hz`} variant="neutral" />
      )}
      {recording && (
        <Chip label="REC" variant="danger" pulse />
      )}
    </header>
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
