/**
 * Shared JSDoc typedefs for Pocket Court data structures.
 * These types are consumed across hooks and components for tooling support.
 */

/**
 * A juror in the generated jury pool.
 *
 * @typedef {object} Juror
 * @property {number} id - Unique juror identifier.
 * @property {string} name - Juror name.
 * @property {number} age - Juror age.
 * @property {string} job - Juror occupation.
 * @property {string} bias_hint - Public-facing bias hint shown to players.
 * @property {string} [hidden_bias] - Hidden bias revealed to the model only.
 */

/**
 * Opposing counsel profile metadata.
 *
 * @typedef {object} OpposingCounsel
 * @property {string} name - Counsel name.
 * @property {string} [age_range] - Optional age range.
 * @property {string} bio - Background and reputation.
 * @property {string} style_tells - Courtroom habits or tells.
 * @property {string} current_posture - Current strategic posture.
 */

/**
 * Case metadata returned by the generator model.
 *
 * @typedef {object} CaseData
 * @property {string} title - Case title for the docket.
 * @property {string} defendant - Defendant name.
 * @property {string} charge - Primary charge or claim.
 * @property {boolean} is_jury_trial - Whether the case proceeds as a jury trial.
 * @property {{name: string, philosophy: string, background: string, bias: string}} judge - Judge profile.
 * @property {Juror[]} jurors - Jury pool for jury trials.
 * @property {string[]} facts - Facts list for the case.
 * @property {{name: string, role: string, statement: string}[]} witnesses - Witness roster.
 * @property {string[]} evidence - Evidence list.
 * @property {OpposingCounsel} opposing_counsel - Opposing counsel profile.
 */

/**
 * State for the jury selection phase.
 *
 * @typedef {object} JuryState
 * @property {boolean} [skipped] - Whether jury selection is skipped for bench trials.
 * @property {Juror[]} [pool] - Full juror pool for the case.
 * @property {number[]} [myStrikes] - Player-selected strike IDs.
 * @property {number[]} [opponentStrikes] - Opposing counsel strike IDs.
 * @property {number[]} [seatedIds] - Juror IDs seated for trial.
 * @property {string} [comment] - Judge comment on the seated jury.
 * @property {boolean} [locked] - Whether jury selection is finalized.
 */

/**
 * Judge ruling payload for a pre-trial motion.
 *
 * @typedef {object} MotionResult
 * @property {string} ruling - GRANTED, DENIED, or PARTIALLY GRANTED.
 * @property {string} outcome_text - Judge's explanation.
 * @property {number} score - Motion score used in final weighting.
 */

/**
 * Motion phase identifiers for the pre-trial exchange.
 *
 * @typedef {'motion_submission' | 'rebuttal_submission' | 'motion_ruling_locked'} MotionPhase
 */

/**
 * State for the pre-trial motion exchange.
 *
 * @typedef {object} MotionState
 * @property {string} motionText - Defense motion text.
 * @property {'defense' | 'prosecution'} motionBy - Role that filed the motion.
 * @property {string} rebuttalText - Prosecution rebuttal text.
 * @property {'defense' | 'prosecution'} rebuttalBy - Role that filed the rebuttal.
 * @property {MotionResult | null} ruling - Judge ruling on the motion exchange.
 * @property {MotionPhase} motionPhase - Current phase of the motion exchange.
 * @property {boolean} locked - Whether the motion phase is finalized.
 */

/**
 * Final verdict payload for the trial phase.
 *
 * @typedef {object} VerdictResult
 * @property {string} jury_verdict - Jury verdict string (or N/A).
 * @property {string} jury_reasoning - Jury rationale text.
 * @property {number} jury_score - Jury score (0 if N/A).
 * @property {number} judge_score - Judge score for legal soundness.
 * @property {string} judge_opinion - Judge's written opinion.
 * @property {string} final_ruling - Final ruling text.
 * @property {boolean} is_jnov - Whether a JNOV occurred.
 * @property {number} final_weighted_score - Weighted score across phases.
 * @property {string | null} achievement_title - Optional achievement title.
 */

/**
 * Full living docket history state.
 *
 * @typedef {object} HistoryState
 * @property {CaseData} [case] - Current case metadata.
 * @property {JuryState} [jury] - Jury selection state.
 * @property {MotionState} [motion] - Motion phase data.
 * @property {string} [counselNotes] - Optional counsel notes captured during play.
 * @property {{text?: string, verdict?: VerdictResult, locked?: boolean}} [trial] - Trial phase data.
 */

export {};
