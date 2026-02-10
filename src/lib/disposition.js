import {
  FINAL_DISPOSITIONS,
  TERMINAL_DISPOSITIONS,
} from './constants';

const normalizeDispositionText = (text) => {
  if (!text) return null;
  const normalized = text.toLowerCase();
  const hasNegatedDismissal = /\b(?:not|no)\s+dismiss(?:ed|al)?\b/.test(normalized);
  const impliesAcquittal =
    /\b(?:found|finds?|judg(?:ment)?\s+entered)\s+(?:for|in favor of)\s+(?:the\s+)?(?:defen[cs]e|defendant|accused)\b/.test(
      normalized
    ) ||
    /\b(?:defen[cs]e|defendant|accused)\s+(?:prevails?|wins?)\b/.test(normalized);
  const impliesConviction =
    /\b(?:found|finds?|judg(?:ment)?\s+entered)\s+(?:for|in favor of)\s+(?:the\s+)?(?:prosecution|state|people)\b/.test(
      normalized
    ) ||
    /\b(?:prosecution|state|people)\s+(?:prevails?|wins?)\b/.test(normalized);

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

  if (normalized.includes('not guilty') || normalized.includes('acquit') || impliesAcquittal) {
    return FINAL_DISPOSITIONS.NOT_GUILTY;
  }

  if (
    normalized.includes('guilty') ||
    normalized.includes('liable') ||
    normalized.includes('convict') ||
    impliesConviction
  ) {
    return FINAL_DISPOSITIONS.GUILTY;
  }

  return null;
};

const buildDispositionLabel = (type, source) => {
  switch (type) {
    case FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE:
      return 'DISMISSED WITH PREJUDICE';
    case FINAL_DISPOSITIONS.DISMISSED_WITHOUT_PREJUDICE:
      return 'DISMISSED WITHOUT PREJUDICE';
    case FINAL_DISPOSITIONS.DISMISSED:
      return source === 'motion' ? 'DISMISSED (PRE-TRIAL MOTION GRANTED)' : 'DISMISSED';
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
  const ruling = motion?.ruling;
  if (!ruling || typeof ruling !== 'object') return null;

  const isDismissed = ruling?.decision?.dismissal?.isDismissed === true;
  if (!isDismissed) return null;

  const withPrejudice = ruling?.decision?.dismissal?.withPrejudice === true;
  const type = withPrejudice
    ? FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE
    : FINAL_DISPOSITIONS.DISMISSED_WITHOUT_PREJUDICE;
  const opinion = ruling?.decision?.opinion?.trim() || ruling?.outcome_text?.trim() || 'No opinion provided.';

  return {
    type,
    source: 'motion',
    summary: buildDispositionLabel(type, 'motion'),
    details: `RULING: ${ruling.ruling} - "${opinion}"`,
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
