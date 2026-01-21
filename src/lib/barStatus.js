import { SANCTION_STATES } from './constants';

const SANCTIONS_LABELS = Object.freeze({
  [SANCTION_STATES.CLEAN]: 'Clean Record',
  [SANCTION_STATES.WARNED]: 'Warning Issued',
  [SANCTION_STATES.SANCTIONED]: 'Sanctioned',
  [SANCTION_STATES.PUBLIC_DEFENDER]: 'Public Defender Assignment',
  [SANCTION_STATES.RECENTLY_REINSTATED]: 'Reinstated (Grace Period)',
});

const SANCTIONS_REASON_SUMMARIES = Object.freeze({
  [SANCTION_STATES.CLEAN]: 'No active sanctions on record.',
  [SANCTION_STATES.WARNED]: 'A warning is currently on file.',
  [SANCTION_STATES.SANCTIONED]: 'An active sanction is on file.',
  [SANCTION_STATES.PUBLIC_DEFENDER]: 'Public defender assignment is active.',
  [SANCTION_STATES.RECENTLY_REINSTATED]: 'Reinstatement grace period is active.',
});

const toTimestampMs = (isoString) => {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatRemainingTime = (remainingMs) => {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

const buildTimer = (label, endsAtIso, nowMs) => {
  const endsAtMs = toTimestampMs(endsAtIso);
  if (!endsAtMs || endsAtMs <= nowMs) return null;
  const remainingMs = endsAtMs - nowMs;
  return {
    label,
    endsAt: new Date(endsAtMs).toISOString(),
    remainingMs,
    remainingLabel: formatRemainingTime(remainingMs),
  };
};

const buildTransition = (state, endsAtIso, nowMs) => {
  const endsAtMs = toTimestampMs(endsAtIso);
  if (!endsAtMs || endsAtMs <= nowMs) return null;
  const remainingMs = endsAtMs - nowMs;
  return {
    state,
    label: SANCTIONS_LABELS[state] ?? 'Status Unknown',
    at: new Date(endsAtMs).toISOString(),
    remainingMs,
    remainingLabel: formatRemainingTime(remainingMs),
  };
};

/**
 * Build a UI-ready status summary for sanctions and reinstatement.
 *
 * @param {object} [input] - Status snapshot input.
 * @param {import('./types').PlayerSanctionsState | null} [input.sanctions] - Sanctions snapshot.
 * @param {import('./types').PublicDefenderStatus | null} [input.pdStatus] - PD snapshot.
 * @param {import('./types').ReinstatementStatus | null} [input.reinstatement] - Reinstatement snapshot.
 * @param {number} [input.nowMs] - Optional timestamp override.
 * @returns {object} Status summary object for UI rendering.
 */
export const buildBarStatus = ({ sanctions, pdStatus, reinstatement, nowMs = Date.now() } = {}) => {
  const state = sanctions?.state ?? null;
  const level = typeof sanctions?.level === 'number' ? sanctions.level : null;
  const label = SANCTIONS_LABELS[state] ?? 'Status Unknown';
  const reason = SANCTIONS_REASON_SUMMARIES[state] ?? 'Status unknown.';

  const timers = [];
  const sanctionEndsAt = sanctions?.expiresAt ?? null;
  const reinstatementEndsAt = reinstatement?.until ?? sanctions?.recentlyReinstatedUntil ?? null;
  const pdEndsAt = pdStatus?.expiresAt ?? (state === SANCTION_STATES.PUBLIC_DEFENDER ? sanctionEndsAt : null);

  if (state === SANCTION_STATES.WARNED) {
    const timer = buildTimer('Warning expires', sanctionEndsAt, nowMs);
    if (timer) timers.push({ key: 'warning', ...timer });
  }
  if (state === SANCTION_STATES.SANCTIONED) {
    const timer = buildTimer('Sanction expires', sanctionEndsAt, nowMs);
    if (timer) timers.push({ key: 'sanction', ...timer });
  }
  if (state === SANCTION_STATES.PUBLIC_DEFENDER || pdStatus) {
    const timer = buildTimer('Public defender ends', pdEndsAt, nowMs);
    if (timer) timers.push({ key: 'public_defender', ...timer });
  }
  if (state === SANCTION_STATES.RECENTLY_REINSTATED || reinstatementEndsAt) {
    const timer = buildTimer('Reinstatement grace ends', reinstatementEndsAt, nowMs);
    if (timer) timers.push({ key: 'reinstatement', ...timer });
  }

  let nextTransition = null;
  if (state === SANCTION_STATES.WARNED || state === SANCTION_STATES.SANCTIONED) {
    nextTransition = buildTransition(SANCTION_STATES.CLEAN, sanctionEndsAt, nowMs);
  } else if (state === SANCTION_STATES.PUBLIC_DEFENDER) {
    nextTransition = buildTransition(SANCTION_STATES.RECENTLY_REINSTATED, pdEndsAt, nowMs);
  } else if (state === SANCTION_STATES.RECENTLY_REINSTATED) {
    nextTransition = buildTransition(SANCTION_STATES.CLEAN, reinstatementEndsAt, nowMs);
  }

  return {
    state,
    level,
    label,
    reason,
    timers,
    nextTransition,
  };
};

export const getSanctionsStateLabel = (state) => SANCTIONS_LABELS[state] ?? 'Status Unknown';
