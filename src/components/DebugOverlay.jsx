import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  debugEnabled,
  getDebugState,
  setDebugFlag,
  subscribeDebugStore,
} from '../lib/debugStore';

const fallbackDebugState = Object.freeze({
  events: [],
  lastAction: null,
  flags: {
    bypassJuryLlm: false,
    verboseLogging: false,
  },
});
const failedSnapshot = Object.freeze({
  debugState: fallbackDebugState,
  storeAvailable: false,
});

let hasStoreFailure = false;

const markStoreFailure = () => {
  hasStoreFailure = true;
};

const useDebugStore = () => {
  const safeGetSnapshot = useCallback(() => {
    if (hasStoreFailure) {
      return failedSnapshot;
    }
    try {
      return { debugState: getDebugState(), storeAvailable: true };
    } catch {
      markStoreFailure();
      return failedSnapshot;
    }
  }, []);

  const safeSubscribe = useCallback((listener) => {
    if (hasStoreFailure) {
      return () => {};
    }
    try {
      return subscribeDebugStore(listener);
    } catch {
      markStoreFailure();
      return () => {};
    }
  }, []);

  const snapshot = useSyncExternalStore(
    safeSubscribe,
    safeGetSnapshot,
    safeGetSnapshot
  );

  return snapshot;
};

const formatJson = (value) => {
  if (!value) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatText = (value) => (value == null || value === '' ? '—' : String(value));

const truncateText = (value, limit = 400) => {
  if (!value) return '—';
  const text = String(value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

export default function DebugOverlay({ gameState, config, history, sanctionsState }) {
  const [visible, setVisible] = useState(false);
  const { debugState, storeAvailable } = useDebugStore();

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.code !== 'F3') return;
      event.preventDefault();
      setVisible((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const juryState = history?.jury ?? {};
  const juryPool = juryState.pool ?? [];
  const selectedJurorIds = juryState.myStrikes ?? [];
  const seatedJurorIds = Array.isArray(juryState.seatedIds)
    ? juryState.seatedIds
    : juryPool.filter((juror) => juror.status === 'seated').map((juror) => juror.id);
  const opponentStrikes = juryState.opponentStrikes ?? [];
  const remainingStrikes = Math.max(0, 2 - selectedJurorIds.length);
  const juryPoolIds = juryPool.map((juror) => juror.id);

  if (!storeAvailable || !debugEnabled() || !visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] pointer-events-none">
      <section className="pointer-events-auto w-[320px] max-h-[70vh] overflow-y-auto rounded border border-amber-300 bg-white/95 shadow-lg text-xs text-slate-900">
        <header className="px-3 py-2 border-b border-amber-100 flex items-center justify-between">
          <div className="font-semibold text-amber-700">Debug Overlay (F3)</div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-800"
          >
            Hide
          </button>
        </header>

        <div className="px-3 py-2 space-y-2">
          <div>
            <div className="font-semibold text-slate-700">Core State</div>
            <div className="mt-1 space-y-1">
              <div>gameState: {formatText(gameState)}</div>
              <div>motionPhase: {formatText(history?.motion?.motionPhase)}</div>
              <div>trialLocked: {String(Boolean(history?.trial?.locked))}</div>
              <div>juryLocked: {String(Boolean(juryState.locked))}</div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-slate-700">Settings</div>
            <div className="mt-1 space-y-1">
              <div>difficulty: {formatText(config?.difficulty)}</div>
              <div>jurisdiction: {formatText(config?.jurisdiction)}</div>
              <div>courtType: {formatText(config?.courtType)}</div>
              <div>sanctionsState: {formatText(sanctionsState?.state)}</div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-slate-700">Jury</div>
            <div className="mt-1 space-y-1">
              <div>selectedJurorIds: {selectedJurorIds.join(', ') || '—'}</div>
              <div>seatedJurorIds: {seatedJurorIds.join(', ') || '—'}</div>
              <div>playerStrikesUsed: {selectedJurorIds.length}</div>
              <div>opponentStrikesUsed: {opponentStrikes.length}</div>
              <div>remainingStrikes: {remainingStrikes}</div>
              <div>juryPoolCount: {juryPool.length}</div>
              <div>juryPoolIds: {juryPoolIds.join(', ') || '—'}</div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-slate-700">Last Action</div>
            {debugState.lastAction ? (
              <div className="mt-1 space-y-1">
                <div>name: {formatText(debugState.lastAction.name)}</div>
                <div>startedAt: {formatText(debugState.lastAction.startedAt)}</div>
                <div>endedAt: {formatText(debugState.lastAction.endedAt)}</div>
                <div>durationMs: {formatText(debugState.lastAction.durationMs)}</div>
                <div>result: {formatText(debugState.lastAction.result)}</div>
                <div>rejectReason: {formatText(debugState.lastAction.rejectReason)}</div>
                <div className="space-y-1">
                  <div>payload:</div>
                  <pre className="whitespace-pre-wrap rounded bg-slate-100 p-2">
                    {formatJson(debugState.lastAction.payload)}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div>parsed:</div>
                  <pre className="whitespace-pre-wrap rounded bg-slate-100 p-2">
                    {formatJson(debugState.lastAction.parsed)}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div>rawModelText:</div>
                  <pre className="whitespace-pre-wrap rounded bg-slate-100 p-2">
                    {truncateText(debugState.lastAction.rawModelText)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-slate-500">—</div>
            )}
          </div>

          <div>
            <div className="font-semibold text-slate-700">Dev Toggles</div>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={debugState.flags.bypassJuryLlm}
                onChange={(event) => setDebugFlag('bypassJuryLlm', event.target.checked)}
              />
              Bypass LLM for jury strikes (auto-approve)
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={debugState.flags.verboseLogging}
                onChange={(event) => setDebugFlag('verboseLogging', event.target.checked)}
              />
              Verbose logging
            </label>
          </div>

          <div>
            <div className="font-semibold text-slate-700">Event Log</div>
            <ul className="mt-1 space-y-1">
              {debugState.events.length === 0 ? (
                <li className="text-slate-500">—</li>
              ) : (
                debugState.events.map((event) => (
                  <li key={event.id} className="border-b border-slate-100 pb-1">
                    <div className="text-[10px] text-slate-500">{event.timestamp}</div>
                    <div>{event.message}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
