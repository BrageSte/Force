interface MetricRowProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  accent?: string;
}

export function MetricRow({ label, value, unit, detail, accent }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right">
        <span className="text-sm font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>
          {value}
          {unit && <span className="text-xs text-muted ml-1">{unit}</span>}
        </span>
        {detail && <span className="block text-[11px] text-muted mt-0.5">{detail}</span>}
      </span>
    </div>
  );
}
