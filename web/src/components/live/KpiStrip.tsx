import { useLiveStore } from '../../stores/liveStore.ts';
import { useAppStore } from '../../stores/appStore.ts';
import { FINGER_NAMES, FINGER_COLORS, TOTAL_COLOR, displayOrder } from '../../constants/fingers.ts';
import { StatCard } from '../shared/StatCard.tsx';

export function KpiStrip() {
  const latestKg = useLiveStore(s => s.latestKg);
  const latestTotalKg = useLiveStore(s => s.latestTotalKg);
  const latestPct = useLiveStore(s => s.latestPct);
  const hasMeaningfulLoad = useLiveStore(s => s.hasMeaningfulLoad);
  const hand = useAppStore(s => s.hand);

  const order = displayOrder(hand);

  return (
    <div className="flex gap-3 flex-wrap">
      <StatCard
        title="Total"
        value={latestTotalKg.toFixed(1)}
        subtitle="kg"
        accent={TOTAL_COLOR}
      />
      {order.map(i => (
        <StatCard
          key={i}
          title={FINGER_NAMES[i]}
          value={latestKg[i].toFixed(1)}
          subtitle={hasMeaningfulLoad ? `${latestPct[i].toFixed(0)}%` : '--'}
          accent={FINGER_COLORS[i]}
        />
      ))}
    </div>
  );
}
