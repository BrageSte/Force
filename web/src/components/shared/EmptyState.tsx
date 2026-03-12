export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted min-h-[120px] px-4">
      <p>{message}</p>
    </div>
  );
}
