import { Home, RefreshCw, Scale } from 'lucide-react';
import { SANCTION_STATES } from '../../lib/constants';

const SANCTIONS_LABELS = Object.freeze({
  [SANCTION_STATES.CLEAN]: 'Clean Record',
  [SANCTION_STATES.WARNED]: 'Warning Issued',
  [SANCTION_STATES.SANCTIONED]: 'Sanctioned',
  [SANCTION_STATES.PUBLIC_DEFENDER]: 'Public Defender Assignment',
  [SANCTION_STATES.RECENTLY_REINSTATED]: 'Reinstated (Grace Period)',
});

const formatSanctionsLabel = (state) => SANCTIONS_LABELS[state] ?? 'Status Unknown';

const buildStatusItems = (before, after) => {
  const items = [];
  if (before && after) {
    if (before.state !== after.state || before.level !== after.level) {
      items.push(
        `Sanctions updated: ${formatSanctionsLabel(before.state)} → ${formatSanctionsLabel(after.state)} (Level ${before.level} → ${after.level}).`
      );
    }
  } else if (after) {
    items.push(
      `Sanctions status: ${formatSanctionsLabel(after.state)} (Level ${after.level}).`
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
 * @param {() => void} props.onNewCase - Handler to start a new case.
 * @param {() => void} props.onMainMenu - Handler to return to the main menu.
 * @returns {JSX.Element} Post-run summary layout.
 */
const PostRun = ({ outcome, onNewCase, onMainMenu }) => {
  const disposition = outcome?.disposition ?? null;
  const sanctionsBefore = outcome?.sanctions?.before ?? null;
  const sanctionsAfter = outcome?.sanctions?.after ?? null;
  const statusItems = buildStatusItems(sanctionsBefore, sanctionsAfter);
  const summaryTitle = disposition?.summary ?? 'Case Closed';
  const summaryDetails =
    disposition?.details ?? 'The court has closed the docket for this run.';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 animate-in fade-in zoom-in duration-500">
      <div className="bg-slate-800 p-6 rounded-full mb-6 shadow-xl border-4 border-amber-500">
        <Scale className="w-16 h-16 text-amber-500" />
      </div>
      <h1 className="text-4xl md:text-5xl font-black text-slate-800 mb-2 tracking-tighter">
        {summaryTitle}
      </h1>
      <p className="text-slate-500 mb-10 text-base font-medium max-w-xl">
        {summaryDetails}
      </p>
      <div className="w-full max-w-2xl space-y-6 text-left">
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Outcome Summary
          </p>
          <p className="text-sm text-slate-600">
            {disposition?.summary ?? 'Awaiting disposition details.'}
          </p>
          {disposition?.details && (
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {disposition.details}
            </pre>
          )}
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Sanctions & Status Updates
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            {statusItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
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
