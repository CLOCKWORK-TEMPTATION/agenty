export function Loading({ message }: { message?: string }) {
  return (
    <div className="loading-container">
      <span className="loading-spinner" />
      {message && <span>{message}</span>}
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`loading-spinner ${size === 'sm' ? 'loading-spinner-sm' : ''}`}
    />
  );
}
