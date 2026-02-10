import React from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { buildBarStatus } from '../../lib/barStatus';
import { SANCTION_STATES } from '../../lib/constants';
import ResultCard from '../shared/ResultCard';

const buildSnapshotRows = (snapshot, profile) => {
  if (!snapshot) {
    return [
      { label: 'Sanctions tier', value: 'Unknown' },
      { label: 'Public Defender', value: 'Unknown' },
    ];
  }

  const pdActive =
    Boolean(profile?.pdStatus) || snapshot.state === SANCTION_STATES.PUBLIC_DEFENDER;
  const barStatus = buildBarStatus({
    sanctions: snapshot,
    pdStatus: profile?.pdStatus ?? null,
    reinstatement: profile?.reinstatement ?? null,
  });
  const tierLabel =
    barStatus.level !== null ? `Tier ${barStatus.level} — ${barStatus.label}` : 'Tier unknown';

  return [
    {
      label: 'Sanctions tier',
      value: tierLabel,
    },
    {
      label: 'Public Defender',
      value: pdActive ? 'Active' : 'Inactive',
    },
  ];
};

const buildStatusItems = (before, after) => {
  const items = [];
  const beforeLabel = before ? buildBarStatus({ sanctions: before }).label : null;
  const afterLabel = after ? buildBarStatus({ sanctions: after }).label : null;

  if (before && after) {
    if (before.state !== after.state || before.level !== after.level) {
      items.push(
        `Sanctions updated: ${beforeLabel} → ${afterLabel} (Level ${before.level} → ${after.level}).`
      );
    }
  } else if (after) {
    items.push(
      `Sanctions status: ${afterLabel} (Level ${after.level}).`
    );
  }

  if (before?.state !== SANCTION_STATES.PUBLIC_DEFENDER && after?.state === SANCTION_STATES.PUBLIC_DEFENDER) {
    items.push('Public Defender assignment is now active.');
  }
  if (before?.state === SANCTION_STATES.PUBLIC_DEFENDER && after?.state !== SANCTION_STATES.PUBLIC_DEFENDER) {
    items.push('Public Defender assignment cleared.');
  }
  if (after?.state === SANCTION_STATES.RECENTLY_REINSTATED) {
    items.push('Reinstatement grace period is active.');
  }

  if (items.length === 0) {
    items.push('No sanctions, public defender, or reinstatement changes recorded this run.');
  }

  return items;
};

/**
 * Post-run summary screen for outcomes and status changes.
 *
 * @param {object} props - Component props.
 * @param {object | null} props.outcome - Terminal run outcome payload.
 * @param {object | null} props.sanctionsState - Current sanctions state.
 * @param {import('../../lib/types').PlayerProfile | null} props.profile - Persisted player profile snapshot.
 * @param {() => void} props.onNewCase - Handler to start a new case.
 * @param {() => void} props.onMainMenu - Handler to return to the main menu.
 * @returns {JSX.Element} Post-run summary layout.
 */
const PostRun = ({ outcome, sanctionsState, profile, onNewCase, onMainMenu }) => {
  const disposition = outcome?.disposition ?? null;
  const sanctionsBefore = outcome?.sanctions?.before ?? null;
  const sanctionsAfter = outcome?.sanctions?.after ?? profile?.sanctions ?? sanctionsState ?? null;
  const beforeRows = buildSnapshotRows(sanctionsBefore, null);
  const afterRows = buildSnapshotRows(sanctionsAfter, profile);
  const statusItems = buildStatusItems(sanctionsBefore, sanctionsAfter);
  const summaryTitle = disposition?.summary ?? 'Case Closed';
  const summaryDetails =
    disposition?.details ?? 'The court has closed the docket for this run.';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 animate-in fade-in zoom-in duration-500">
      <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-2 tracking-tighter break-words">
        {summaryTitle}
      </h1>
      <p className="text-slate-500 mb-10 text-base font-medium max-w-xl">
        {summaryDetails}
      </p>
      <div className="w-full max-w-2xl space-y-6 text-left">
        <ResultCard title="Outcome Summary" className="rounded-xl p-6 space-y-3">
          <p className="text-sm text-slate-600">
            {disposition?.summary ?? 'Awaiting disposition details.'}
          </p>
          {disposition?.details && (
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {disposition.details}
            </pre>
            )}
        </ResultCard>
        <ResultCard title="Run Impact" className="rounded-xl p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Before this run
              </p>
              <dl className="mt-3 space-y-2">
                {beforeRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-slate-500">{row.label}</dt>
                    <dd className="text-slate-700">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                After this run
              </p>
              <dl className="mt-3 space-y-2">
                {afterRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-slate-500">{row.label}</dt>
                    <dd className="text-slate-700">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </ResultCard>
        <ResultCard title="Sanctions & Status Updates" className="rounded-xl p-6 space-y-3">
          <ul className="space-y-2 text-sm text-slate-600">
            {statusItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ResultCard>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-4 mt-10">
        <button
          type="button"
          onClick={onNewCase}
          className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-transform hover:bg-amber-600 active:scale-95 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> New Case
        </button>
        <button
          type="button"
          onClick={onMainMenu}
          className="rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" /> Main Menu
        </button>
      </div>
    </div>
  );
};

export default PostRun;
