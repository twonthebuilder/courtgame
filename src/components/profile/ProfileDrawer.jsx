import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserCircle, X } from 'lucide-react';
import { buildBarStatus } from '../../lib/barStatus';
import { loadRunHistory } from '../../lib/persistence';

const formatTokenLabel = (token) => {
  if (!token) return null;
  return String(token)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatOutcomeLabel = (outcome) => formatTokenLabel(outcome) ?? 'Outcome unavailable';

const formatTimestamp = (timestamp) => {
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
};

const getLastCompletedRun = (runs = []) => {
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    if (runs[i]?.outcome) return runs[i];
  }
  return null;
};

const ProfileDrawer = ({
  profile,
  isOpen: isOpenProp,
  onOpen,
  onClose,
  showTrigger = true,
}) => {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isControlled = typeof isOpenProp === 'boolean';
  const isOpen = isControlled ? isOpenProp : isOpenInternal;
  const barStatus = useMemo(
    () => buildBarStatus({
      sanctions: profile?.sanctions ?? null,
      pdStatus: profile?.pdStatus ?? null,
      reinstatement: profile?.reinstatement ?? null,
    }),
    [profile]
  );
  const stats = profile?.stats ?? {
    runsCompleted: 0,
    verdictsFinalized: 0,
    sanctionsIncurred: 0,
  };
  const achievementsCount = profile?.achievements?.length ?? 0;

  const openDrawer = useCallback(() => {
    if (!isControlled) {
      setIsOpenInternal(true);
    }
    if (onOpen) {
      onOpen();
    }
  }, [isControlled, onOpen]);

  const closeDrawer = useCallback(() => {
    if (!isControlled) {
      setIsOpenInternal(false);
    }
    if (onClose) {
      onClose();
    }
  }, [isControlled, onClose]);

  const lastRun = useMemo(() => {
    if (!isOpen) return null;
    const history = loadRunHistory();
    return getLastCompletedRun(history?.runs ?? []);
  }, [isOpen]);
  const lastRunSummary = useMemo(() => {
    if (!lastRun?.sanctionDelta) return null;
    const before = lastRun.sanctionDelta.before
      ? buildBarStatus({ sanctions: lastRun.sanctionDelta.before }).label
      : null;
    const after = lastRun.sanctionDelta.after
      ? buildBarStatus({ sanctions: lastRun.sanctionDelta.after }).label
      : null;
    if (!before && !after) return null;
    return `${before ?? 'No record'} → ${after ?? 'No record'}`;
  }, [lastRun]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeydown = (event) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [closeDrawer, isOpen]);

  return (
    <>
      {showTrigger && (
        <button
          type="button"
          onClick={openDrawer}
          className="fixed bottom-4 right-4 z-[80] inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-md transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
          aria-label="Open profile drawer"
        >
          <UserCircle className="h-4 w-4" />
          Profile
        </button>
      )}
      {isOpen && (
        <div
          className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/40 backdrop-blur-sm"
          onClick={closeDrawer}
          role="presentation"
        >
          <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label="Profile summary"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Profile</p>
                  <p className="text-sm font-semibold text-slate-700">Snapshot overview</p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  aria-label="Close profile drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Bar Status
                    </p>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Tier {barStatus.level ?? 'Unknown'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{barStatus.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{barStatus.reason}</p>
                  {barStatus.timers.length > 0 && (
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {barStatus.timers.map((timer) => (
                        <div key={timer.key} className="flex items-center justify-between gap-4">
                          <span>{timer.label}</span>
                          <span className="font-semibold text-slate-700">
                            {timer.remainingLabel} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Key Stats
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-3">
                      <p className="text-xs font-semibold text-slate-500">Runs</p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {stats.runsCompleted ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-3">
                      <p className="text-xs font-semibold text-slate-500">Verdicts</p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {stats.verdictsFinalized ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-3">
                      <p className="text-xs font-semibold text-slate-500">Awards</p>
                      <p className="mt-1 text-lg font-bold text-slate-800">{achievementsCount}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Last Run Outcome
                  </p>
                  {lastRun ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-500">Outcome</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {formatOutcomeLabel(lastRun.outcome)}
                        </span>
                      </div>
                      {lastRun.caseTitle && (
                        <p className="text-xs text-slate-500">Case: {lastRun.caseTitle}</p>
                      )}
                      {lastRun.judgeName && (
                        <p className="text-xs text-slate-500">Judge: {lastRun.judgeName}</p>
                      )}
                      {(lastRun.playerRole ||
                        lastRun.jurisdiction ||
                        lastRun.courtType ||
                        lastRun.difficulty) && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                          {lastRun.playerRole && (
                            <span>Role: {formatTokenLabel(lastRun.playerRole)}</span>
                          )}
                          {lastRun.difficulty && (
                            <span>Difficulty: {formatTokenLabel(lastRun.difficulty)}</span>
                          )}
                          {lastRun.jurisdiction && (
                            <span>Jurisdiction: {formatTokenLabel(lastRun.jurisdiction)}</span>
                          )}
                          {lastRun.courtType && (
                            <span>Court: {formatTokenLabel(lastRun.courtType)}</span>
                          )}
                        </div>
                      )}
                      {lastRunSummary && (
                        <p className="text-xs text-slate-500">
                          Sanctions: {lastRunSummary}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        {typeof lastRun.score === 'number' && (
                          <span>Score: {lastRun.score}</span>
                        )}
                        {formatTimestamp(lastRun.endedAt) && (
                          <span>Ended: {formatTimestamp(lastRun.endedAt)}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">No completed runs yet.</p>
                  )}
                </section>
              </div>

              <div className="border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileDrawer;
