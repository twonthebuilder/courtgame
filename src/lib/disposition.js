import {
  FINAL_DISPOSITIONS,
  TERMINAL_DISPOSITIONS,
} from './constants';

const normalizeDispositionText = (text) => {
  if (!text) return null;
  const normalized = text.toLowerCase();
  const hasNegatedDismissal = /\b(?:not|no)\s+dismiss(?:ed|al)?\b/.test(normalized);

  if (normalized.includes('dismiss') && !hasNegatedDismissal) {
    if (normalized.includes('without prejudice')) {
      return FINAL_DISPOSITIONS.DISMISSED_WITHOUT_PREJUDICE;
    }
    if (normalized.includes('with prejudice')) {
      return FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE;
    }
    return FINAL_DISPOSITIONS.DISMISSED;
  }

  if (normalized.includes('hung') && normalized.includes('jury')) {
    return FINAL_DISPOSITIONS.MISTRIAL_HUNG_JURY;
  }

  if (normalized.includes('mistrial')) {
    return FINAL_DISPOSITIONS.MISTRIAL_CONDUCT;
  }

  if (normalized.includes('not guilty') || normalized.includes('acquit')) {
    return FINAL_DISPOSITIONS.NOT_GUILTY;
  }

  if (
    normalized.includes('guilty') ||
    normalized.includes('liable') ||
    normalized.includes('convict')
  ) {
    return FINAL_DISPOSITIONS.GUILTY;
  }

  return null;
};

const buildDispositionLabel = (type, source) => {
  switch (type) {
    case FINAL_DISPOSITIONS.DISMISSED:
    case FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE:
    case FINAL_DISPOSITIONS.DISMISSED_WITHOUT_PREJUDICE:
      return source === 'motion' ? 'Dismissed (Pre-Trial Motion Granted)' : 'Dismissed';
    case FINAL_DISPOSITIONS.MISTRIAL_HUNG_JURY:
      return 'Mistrial (Hung Jury)';
    case FINAL_DISPOSITIONS.MISTRIAL_CONDUCT:
      return 'Mistrial (Conduct)';
    case FINAL_DISPOSITIONS.NOT_GUILTY:
      return 'Not Guilty';
    case FINAL_DISPOSITIONS.GUILTY:
      return 'Guilty';
    default:
      return 'Final Disposition';
  }
};

export const isTerminalDisposition = (disposition) => {
  if (!disposition) return false;
  const type = typeof disposition === 'string' ? disposition : disposition.type;
  return TERMINAL_DISPOSITIONS.has(type);
};

export const guardDisposition = (current, next) =>
  isTerminalDisposition(current) ? current : next;

export const deriveDispositionFromMotion = (motion) => {
  const ruling = motion?.ruling?.ruling?.toLowerCase().replace(/_/g, ' ').trim();
  if (!ruling || !['granted', 'partially granted'].includes(ruling)) return null;
  const outcomeText = motion?.ruling?.outcome_text?.trim();
  if (!outcomeText) return null;
  const type = normalizeDispositionText(outcomeText);
  if (!type) return null;

  return {
    type,
    source: 'motion',
    summary: buildDispositionLabel(type, 'motion'),
    details: `RULING: ${motion.ruling.ruling} - "${outcomeText}"`,
  };
};

export const deriveDispositionFromVerdict = (verdict) => {
  const finalRuling = verdict?.final_ruling?.trim();
  if (!finalRuling) return null;
  const type = normalizeDispositionText(finalRuling);
  if (!type) return null;

  const details = [];
  if (verdict.jury_verdict && verdict.jury_verdict !== 'N/A') {
    details.push(`JURY VERDICT: ${verdict.jury_verdict}`);
    if (verdict.jury_reasoning) {
      details.push(`JURY REASONING: "${verdict.jury_reasoning}"`);
    }
  }
  if (verdict.judge_opinion) {
    details.push(`JUDGE OPINION: "${verdict.judge_opinion}"`);
  }

  return {
    type,
    source: 'verdict',
    summary: finalRuling,
    details: details.join('\n'),
  };
};

export const isMeritReleaseDisposition = (disposition) => {
  if (!disposition) return false;
  return [
    FINAL_DISPOSITIONS.NOT_GUILTY,
    FINAL_DISPOSITIONS.DISMISSED,
    FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE,
    FINAL_DISPOSITIONS.DISMISSED_WITHOUT_PREJUDICE,
  ].includes(disposition.type ?? disposition);
};

export const __testables = {
  normalizeDispositionText,
  buildDispositionLabel,
};
