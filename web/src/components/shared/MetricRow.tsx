interface MetricRowProps {
  label: string;
  value: string;
  unit?: string;
}

export function MetricRow({ label, value, unit }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums">
        {value}
        {unit && <span className="text-xs text-muted ml-1">{unit}</span>}
      </span>
    </div>
  );
}
