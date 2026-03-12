export type PageId = 'live' | 'train' | 'test' | 'session' | 'history' | 'profile' | 'settings';

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: string }> = [
  { id: 'live', label: 'LIVE', icon: '◉' },
  { id: 'train', label: 'TRAIN', icon: '▣' },
  { id: 'test', label: 'TEST', icon: '△' },
  { id: 'session', label: 'SESSION', icon: '◧' },
  { id: 'history', label: 'HISTORY', icon: '☰' },
  { id: 'profile', label: 'PROFILE', icon: '◌' },
  { id: 'settings', label: 'SETTINGS', icon: '⚙' },
];

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-52 shrink-0 bg-surface border-r border-border flex flex-col">
      <div className="px-5 py-6">
        <h1 className="text-lg font-bold tracking-wide text-text">FingerForce</h1>
        <p className="text-xs text-muted mt-0.5">Climbing Force Analyzer</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activePage === item.id
                ? 'bg-primary/15 text-primary'
                : 'text-muted hover:text-text hover:bg-surface-alt'
            }`}
          >
            <span className="mr-2.5 text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-muted/50">
        v0.1 MVP
      </div>
    </aside>
  );
}
