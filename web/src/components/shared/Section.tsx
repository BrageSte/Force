import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold mb-4 text-text">{title}</h3>
      {children}
    </div>
  );
}
