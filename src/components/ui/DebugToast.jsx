import { debugEnabled } from '../../lib/debugStore';

export default function DebugToast({ message }) {
  if (!debugEnabled() || !message) return null;

  return (
    <div className="fixed top-20 right-4 z-[90]">
      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 shadow">
        {message}
      </div>
    </div>
  );
}
