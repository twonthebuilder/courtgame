# Sanctions Timers Inventory

This document summarizes the sanction timing constants and the normalization rules that
apply them on load.

## Timer Catalog (`SANCTIONS_TIMERS_MS`)

| Timer | Duration | Purpose |
| --- | --- | --- |
| `RECIDIVISM_WINDOW` | 30 minutes | Lookback window used to decide whether a new misconduct entry counts as recidivism when escalating sanctions. |
| `COOLDOWN_RESET` | 2 hours | Cooldown window after the last misconduct; once elapsed, recidivism counters are cleared during normalization. |
| `WARNING_DURATION` | 15 minutes | Warning state window before returning to clean. |
| `SANCTION_DURATION` | 5 minutes | Tier-2 sanction window before returning to clean if no additional escalation occurs. |
| `PUBLIC_DEFENDER_DURATION` | 60 minutes | Public defender assignment (disbarment) window before reinstatement begins. |
| `REINSTATEMENT_GRACE` | 20 minutes | Grace period after a public defender assignment ends before returning to clean. |

## Sanctions State Normalization (`normalizeSanctionsState`)

`normalizeSanctionsState` hydrates persisted sanctions data with defaults, validates the
state identifier, and then enforces the timers on load:

- **Public defender assignment**: players remain in `PUBLIC_DEFENDER` until they win a
  public defender case; expiration timestamps do not auto-clear the assignment state.
- **Reinstatement grace**: if `RECENTLY_REINSTATED` has expired, the state returns to
  `CLEAN` and clears the recidivism count.
- **Warning/Sanction durations**: if `WARNED` or `SANCTIONED` has expired, the state
  returns to `CLEAN` and clears the recidivism count.
- **Recidivism cooldown**: if the cooldown window since `lastMisconductAt` has elapsed,
  the recidivism count is cleared even if the current state remains active.

These normalization rules ensure that expired sanctions do not persist across sessions and
that cooldown resets are applied consistently.
