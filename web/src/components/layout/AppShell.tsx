import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex text-text">
      {children}
    </div>
  );
}

export function MainContent({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {children}
    </main>
  );
}

export function PageContent({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-auto p-5">
      {children}
    </div>
  );
}
