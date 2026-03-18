import { FINGER_COLORS, FINGER_NAMES, TOTAL_COLOR, displayFingerOrder } from '../../../constants/fingers.ts';
import type { Finger4, Hand } from '../../../types/force.ts';

interface LiveForcePanelProps {
  hand: Hand;
  latestTotalKg: number;
  latestKg: Finger4 | null;
  tareRequired: boolean;
  canTare: boolean;
  hasMeaningfulLoad: boolean;
  perFingerForce: boolean;
  verificationBlocked: boolean;
  verificationReason: string | null;
  onTare: () => void;
}

export function LiveForcePanel({
  hand,
  latestTotalKg,
  latestKg,
  tareRequired,
  canTare,
  hasMeaningfulLoad,
  perFingerForce,
  verificationBlocked,
  verificationReason,
  onTare,
}: LiveForcePanelProps) {
  const order = displayFingerOrder(hand);

  if (verificationBlocked) {
    return (
      <div className="bg-surface rounded-xl border border-danger/30 p-4 text-danger">
        <div className="text-xs uppercase tracking-wide">Live Force</div>
        <div className="mt-2 text-lg font-semibold text-text">Live force is hidden until runtime verification passes.</div>
        <div className="mt-2 text-sm">{verificationReason ?? 'Waiting for a verified stream.'}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted uppercase tracking-wide">Live Force</div>
          <div className="text-4xl font-bold mt-2 tabular-nums" style={{ color: TOTAL_COLOR }}>
            {latestTotalKg.toFixed(1)} kg
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {tareRequired && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger/15 text-danger border border-danger/30">
              Tare required
            </span>
          )}
          <button
            onClick={onTare}
            disabled={!canTare}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-alt border border-border text-text disabled:opacity-30"
          >
            Tare
          </button>
        </div>
      </div>
      {perFingerForce ? (
        <div className="grid grid-cols-2 gap-2 mt-4">
          {order.map(i => (
            <div key={FINGER_NAMES[i]} className="bg-surface-alt rounded-lg p-2">
              <div className="text-[11px] text-muted">{FINGER_NAMES[i]}</div>
              <div className="text-sm font-semibold tabular-nums" style={{ color: FINGER_COLORS[i] }}>
                {(latestKg?.[i] ?? 0).toFixed(1)} kg
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-border bg-surface-alt px-3 py-3 text-sm text-muted">
          This device provides total force only.
        </div>
      )}
      {tareRequired && (
        <div className="mt-3 text-xs text-danger">
          Negative drift below -1.0 kg detected. Tare before the next attempt.
        </div>
      )}
      {!hasMeaningfulLoad && (
        <div className="mt-3 text-xs text-muted">
          UI stays visually quiet below 1.0 kg, but guided test capture still keeps the measured onset samples.
        </div>
      )}
    </div>
  );
}
