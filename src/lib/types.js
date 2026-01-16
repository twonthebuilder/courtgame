/**
 * Shared JSDoc typedefs for Pocket Court data structures.
 * These types are consumed across hooks and components for tooling support.
 */

/**
 * Canonical identifiers for game phases, case types, jurisdictions, and dispositions.
 *
 * @typedef {typeof import('./constants').GAME_PHASES[keyof typeof import('./constants').GAME_PHASES]} GamePhase
 * @typedef {typeof import('./constants').CASE_TYPES[keyof typeof import('./constants').CASE_TYPES]} CaseType
 * @typedef {typeof import('./constants').JURISDICTIONS[keyof typeof import('./constants').JURISDICTIONS]} Jurisdiction
 * @typedef {typeof import('./constants').FINAL_DISPOSITIONS[keyof typeof import('./constants').FINAL_DISPOSITIONS]} FinalDisposition
 * @typedef {typeof import('./constants').SANCTION_STATES[keyof typeof import('./constants').SANCTION_STATES]} SanctionsState
 */

/**
 * A juror in the generated jury pool.
 *
 * @typedef {'eligible' | 'struck_by_player' | 'struck_by_opponent' | 'seated'} JurorStatus
 *
 * @typedef {object} Juror
 * @property {number} id - Unique juror identifier.
 * @property {string} name - Juror name.
 * @property {number} age - Juror age.
 * @property {string} job - Juror occupation.
 * @property {string} bias_hint - Public-facing bias hint shown to players.
 * @property {string} [hidden_bias] - Hidden bias revealed to the model only.
 * @property {JurorStatus} status - Current juror status for voir dire tracking.
 * @property {JurorStatus[]} [status_history] - Optional status transition history.
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
 * @typedef {'admissible' | 'suppressed'} EvidenceStatus
 *
 * @typedef {object} EvidenceItem
 * @property {number} id - Evidence identifier within the docket.
 * @property {string} text - Evidence description.
 * @property {EvidenceStatus} status - Current admissibility status.
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
 * @property {EvidenceItem[]} evidence - Evidence list.
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
 * @property {boolean} [invalidStrike] - Whether the last strike submission was rejected.
 * @property {boolean} [locked] - Whether jury selection is finalized.
 */

/**
 * Judge ruling payload for a pre-trial motion.
 *
 * @typedef {object} EvidenceStatusUpdate
 * @property {number} id - Evidence identifier referenced by the ruling.
 * @property {EvidenceStatus} status - Updated admissibility status.
 *
 * @typedef {object} MotionResult
 * @property {string} ruling - GRANTED, DENIED, or PARTIALLY GRANTED.
 * @property {string} outcome_text - Judge's explanation.
 * @property {number} score - Motion score used in final weighting.
 * @property {EvidenceStatusUpdate[]} evidence_status_updates - Evidence admissibility updates.
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
 * @property {string | null} overflow_reason_code - Reason code when score exceeds 100.
 * @property {string | null} overflow_explanation - Short explanation when score exceeds 100.
 * @property {string | null} achievement_title - Optional achievement title.
 */

/**
 * Submission compliance classification for docket validation.
 *
 * @typedef {'compliant' | 'partially_compliant' | 'non_compliant'} SubmissionCompliance
 */

/**
 * Validation record for a docket submission.
 *
 * @typedef {object} SubmissionValidation
 * @property {string} id - Unique identifier for the validation record.
 * @property {'motion' | 'rebuttal' | 'argument' | 'verdict'} phase - Submission phase.
 * @property {'defense' | 'prosecution' | 'judge'} submitted_by - Actor for the submission.
 * @property {string} text - Submitted text captured for validation.
 * @property {{
 *   facts: {found: number[], missing: number[]},
 *   evidence: {found: number[], missing: number[], inadmissible: number[]},
 *   witnesses: {found: number[], missing: number[]},
 *   jurors: {found: number[], missing: number[]},
 *   rulings: {found: number[], missing: number[]}
 * }} references - Reference resolution results.
 * @property {SubmissionCompliance} classification - Overall compliance classification.
 * @property {string} timestamp - ISO timestamp when validation was recorded.
 */

/**
 * Rejected verdict payload stored in the docket.
 *
 * @typedef {object} VerdictRejection
 * @property {object} payload - Verdict payload returned by the model.
 * @property {string} reason - Short reason for rejection.
 * @property {SubmissionValidation} validation - Validation metadata for the rejection.
 * @property {string} timestamp - ISO timestamp when the rejection was recorded.
 */

/**
 * Sanction visibility for how acknowledgments should render in-world.
 *
 * @typedef {typeof import('./constants').SANCTION_VISIBILITY[keyof typeof import('./constants').SANCTION_VISIBILITY]} SanctionVisibility
 */

/**
 * Sanction trigger categories used for docketed acknowledgments.
 *
 * @typedef {typeof import('./constants').SANCTION_REASON_CODES[keyof typeof import('./constants').SANCTION_REASON_CODES]} SanctionTrigger
 */

/**
 * Sanction state lifecycle for explicit docket entries.
 *
 * @typedef {typeof import('./constants').SANCTION_ENTRY_STATES[keyof typeof import('./constants').SANCTION_ENTRY_STATES]} SanctionState
 */

/**
 * Sanction or conduct acknowledgment recorded in the living docket.
 *
 * @typedef {object} SanctionRecord
 * @property {string} id - Unique identifier for the docket entry.
 * @property {SanctionState} state - Current sanction state recorded by the court.
 * @property {SanctionTrigger} trigger - Category of conduct that prompted the entry.
 * @property {string} docket_text - Explicit judge acknowledgment recorded on the docket.
 * @property {SanctionVisibility} visibility - How the acknowledgment is surfaced in-world.
 * @property {string} timestamp - ISO timestamp for the entry.
 */

/**
 * Full living docket history state.
 *
 * @typedef {object} DispositionRecord
 * @property {FinalDisposition} type - Canonical disposition identifier.
 * @property {'motion' | 'verdict'} source - Lifecycle source of the disposition.
 * @property {string} summary - Display-friendly summary of the disposition.
 * @property {string} details - Display-friendly details for the disposition.
 *
 * @typedef {object} HistoryState
 * @property {CaseData} [case] - Current case metadata.
 * @property {JuryState} [jury] - Jury selection state.
 * @property {MotionState} [motion] - Motion phase data.
 * @property {string} [counselNotes] - Optional counsel notes captured during play.
 * @property {DispositionRecord | null} [disposition] - Canonical final disposition record.
 * @property {{
 *   text?: string,
 *   verdict?: VerdictResult,
 *   rejectedVerdicts?: VerdictRejection[],
 *   locked?: boolean
 * }} [trial] - Trial phase data.
 * @property {SanctionRecord[]} [sanctions] - Explicit docketed sanction acknowledgments.
 * @property {SubmissionValidation[]} [validationHistory] - Docket validation history.
 */

export {};
