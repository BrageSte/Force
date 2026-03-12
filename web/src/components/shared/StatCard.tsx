interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  accent?: string;
}

export function StatCard({ title, value, subtitle, accent }: StatCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border px-4 py-3 min-w-[140px]">
      <div className="text-xs text-muted font-medium uppercase tracking-wide">{title}</div>
      <div
        className="text-2xl font-bold mt-1 tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-muted mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}
