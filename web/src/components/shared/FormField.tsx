import type { ReactNode } from 'react';

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-muted mb-1.5">{label}</div>
      {children}
    </label>
  );
}

export function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}
