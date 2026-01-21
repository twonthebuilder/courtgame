/**
 * Shared JSDoc typedefs for Pocket Court data structures.
 * These types are consumed across hooks and components for tooling support.
 */

/**
 * Canonical identifiers for game phases, case types, jurisdictions, and dispositions.
 *
 * @typedef {typeof import('./constants').GAME_PHASES[keyof typeof import('./constants').GAME_PHASES]} GamePhase
 * @typedef {typeof import('./constants').CASE_TYPES[keyof typeof import('./constants').CASE_TYPES]} CaseType
 * @typedef {typeof import('./constants').COURT_TYPES[keyof typeof import('./constants').COURT_TYPES]} CourtType
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
 * @typedef {object} MotionRulingIssue
 * @property {string} id - Stable issue identifier (unique within the ruling).
 * @property {string} label - Short issue label for UI headings.
 * @property {'GRANTED' | 'DENIED' | 'PARTIALLY GRANTED'} disposition - Issue disposition enum.
 * @property {string} reasoning - Concise reasoning grounded in docket facts.
 * @property {number[]} [affectedEvidenceIds] - Evidence IDs impacted by the issue (must exist in the docket).
 *
 * @typedef {object} MotionRulingBreakdown
 * @property {MotionRulingIssue[]} issues - Required list of issues ruled on.
 * @property {string[]} docket_entries - Required docket-ready notes to append to the motion record.
 *
 * @typedef {object} MotionResult
 * @property {'GRANTED' | 'DENIED' | 'PARTIALLY GRANTED'} ruling - Required ruling enum.
 * @property {string} outcome_text - Required judge explanation.
 * @property {number} score - Required motion score used in final weighting.
 * @property {EvidenceStatusUpdate[]} evidence_status_updates - Required updates for every evidence ID in the docket.
 * @property {MotionRulingBreakdown} breakdown - Required per-issue breakdown for the ruling.
 * @property {string[]} [docket_entries] - Normalized docket entries for docket summaries.
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

/**
 * Persisted sanctions state snapshot for a player profile.
 *
 * @typedef {object} PlayerSanctionsState
 * @property {SanctionsState} state - Canonical sanctions state identifier (public_defender implies disbarment in UI).
 * @property {number} level - Numeric sanction level.
 * @property {string} startedAt - ISO timestamp when the current sanctions state began.
 * @property {string | null} expiresAt - ISO timestamp when the current sanctions state expires.
 * @property {string | null} lastMisconductAt - ISO timestamp of the last misconduct entry.
 * @property {number} recidivismCount - Count of recent misconduct events.
 * @property {string | null} recentlyReinstatedUntil - ISO timestamp for the reinstatement grace period.
 */

/**
 * Snapshot delta for sanctions state across a single run.
 *
 * @typedef {object} SanctionsDelta
 * @property {PlayerSanctionsState | null} before - Sanctions snapshot at run start.
 * @property {PlayerSanctionsState | null} after - Sanctions snapshot at run end.
 */

/**
 * Persisted public defender status snapshot.
 *
 * @typedef {object} PublicDefenderStatus
 * @property {string} startedAt - ISO timestamp for the public defender assignment.
 * @property {string | null} expiresAt - ISO timestamp for the public defender assignment end.
 */

/**
 * Persisted reinstatement status snapshot.
 *
 * @typedef {object} ReinstatementStatus
 * @property {string} until - ISO timestamp for the reinstatement grace period.
 */

/**
 * Persisted player stats snapshot.
 *
 * @typedef {object} PlayerStats
 * @property {number} runsCompleted - Total completed runs.
 * @property {number} verdictsFinalized - Total finalized verdicts.
 * @property {number} sanctionsIncurred - Total sanctions incurred across runs.
 */

/**
 * Persisted achievement metadata.
 *
 * @typedef {object} PlayerAchievement
 * @property {string} title - Achievement title.
 * @property {string} awardedAt - ISO timestamp when the achievement was awarded.
 * @property {string | null} runId - Associated run identifier, if available.
 */

/**
 * Persisted player profile metadata (v1 schema).
 *
 * @typedef {object} PlayerProfile
 * @property {number} schemaVersion - Profile schema version.
 * @property {string} createdAt - ISO timestamp when the profile was created.
 * @property {string} updatedAt - ISO timestamp when the profile was last updated.
 * @property {PlayerSanctionsState | null} sanctions - Persisted sanctions state snapshot.
 * @property {PublicDefenderStatus | null} pdStatus - Public defender assignment snapshot.
 * @property {ReinstatementStatus | null} reinstatement - Reinstatement grace snapshot.
 * @property {PlayerStats} stats - Aggregated player stats.
 * @property {PlayerAchievement[]} achievements - Awarded achievements.
 */

/**
 * Persisted run history entry (v2 schema).
 *
 * @typedef {object} RunHistoryEntry
 * @property {string} id - Unique run identifier.
 * @property {string} startedAt - ISO timestamp when the run started.
 * @property {string | null} endedAt - ISO timestamp when the run ended.
 * @property {string} jurisdiction - Jurisdiction selected for the run.
 * @property {string} difficulty - Difficulty setting for the run.
 * @property {string} courtType - Court type selected for the run.
 * @property {string} playerRole - Player role for the run.
 * @property {string | null} caseTitle - Case title for the run.
 * @property {string | null} judgeName - Presiding judge for the run.
 * @property {string | null} outcome - Final outcome type when available.
 * @property {number | null} score - Final weighted score when a verdict is reached.
 * @property {string | null} achievementId - Achievement identifier when awarded.
 * @property {SanctionsDelta | null} sanctionDelta - Sanctions snapshot delta for the run.
 */

/**
 * Persisted run history metadata (v1 schema).
 *
 * @typedef {object} RunHistory
 * @property {number} schemaVersion - Run history schema version.
 * @property {string} createdAt - ISO timestamp when the history record was created.
 * @property {string} updatedAt - ISO timestamp when the history record was last updated.
 * @property {RunHistoryEntry[]} runs - Persisted run entries.
 */

export {};
