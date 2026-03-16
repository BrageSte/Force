import type { SourceKind } from '../../types/settings.ts';
import { capabilitySummary, defaultConnectedDevice } from '../../device/deviceProfiles.ts';

const DEVICE_OPTIONS: SourceKind[] = ['Serial', 'Tindeq', 'Simulator'];

interface DevicePickerModalProps {
  open: boolean;
  selectedSourceKind: SourceKind;
  onClose: () => void;
  onSelect: (kind: SourceKind) => void;
}

export function DevicePickerModal({
  open,
  selectedSourceKind,
  onClose,
  onSelect,
}: DevicePickerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Choose Device</h2>
            <p className="text-xs text-muted mt-1">Pick the hardware path for this session before connecting.</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-alt border border-border text-muted hover:text-text"
          >
            Close
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEVICE_OPTIONS.map(kind => {
            const device = defaultConnectedDevice(kind);
            const selected = kind === selectedSourceKind;
            return (
              <button
                key={kind}
                onClick={() => {
                  onSelect(kind);
                  onClose();
                }}
                className={`text-left rounded-2xl border p-4 transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'border-border bg-surface-alt hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{device.deviceLabel}</div>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{device.transport}</span>
                </div>
                <div className="text-xs text-muted mt-2">{device.deviceName}</div>
                <div className="text-xs text-muted mt-3">{capabilitySummary(device.capabilities)}</div>
                {!device.capabilities.perFingerForce && (
                  <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                    Total force only
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
