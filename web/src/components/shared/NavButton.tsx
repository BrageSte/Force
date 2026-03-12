export function NavButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-primary/20 text-primary'
          : 'bg-surface-alt border border-border text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  );
}
