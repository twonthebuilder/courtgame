# LLM Client Wrapper

## Purpose
The LLM client centralizes every Gemini request for Pocket Court and guarantees consistent JSON parsing, validation, and error handling. It exists to ensure that game phases (case generation, jury strikes, motions, and verdicts) always work from a normalized response shape instead of hand-parsed strings scattered across the codebase.

## What the Client Does
- **Single request path:** `requestLlmJson` accepts a `systemPrompt` and `userPrompt` string and returns parsed JSON.
- **Standardized error handling:** failures throw `LlmClientError` with a stable `code`, `userMessage`, and optional debug `context`.
- **Schema validation:** `parseCaseResponse`, `parseJuryResponse`, `parseMotionResponse`, and `parseVerdictResponse` check essential fields and types so the UI never operates on incomplete data.

## Validation Strategy
The parsers focus on required fields only:
- **Case:** title, facts array, judge metadata, jury flag, and jurors when applicable.
- **Jury:** opponent strikes, seated juror IDs, and judge comment.
- **Motion:** ruling enum, structured `decision` object (`ruling`, `dismissal`, `opinion`), score, and docket breakdown.
- **Verdict:** ruling, weighted score, judge opinion, and overflow fields when score exceeds 100.

If a required field is missing or the type is incorrect, a `LlmClientError` is thrown with the `INVALID_RESPONSE` code so the UI can display a consistent fallback message.

**Admissibility gate:** verdict payloads are screened against the docket; if the model relies on off-docket facts or suppressed evidence, the verdict is rejected and the trial remains open for a retry.

## Error Codes
| Code | Meaning |
| --- | --- |
| `CONFIG_MISSING` | Gemini API key is missing. |
| `INVALID_JSON` | Model returned malformed JSON. |
| `INVALID_RESPONSE` | Required fields are missing or invalid. |
| `REQUEST_FAILED` | Network/request failure before validation. |

## Game Flow Integration
`useGameState` now calls the client wrapper for every phase. If validation fails, the UI receives a friendly error message and the game state remains stable until the user retries.
