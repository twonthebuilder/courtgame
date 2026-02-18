# Pocket Court Configuration

## Overview
Pocket Court centralizes shared configuration in `src/lib/config.js`, including game defaults plus AI provider/model/endpoint resolution. This keeps UI selectors, environment mapping, and runtime behavior aligned in one place.

## Environment Variables
The Gemini API key and optional model configuration are read from Vite's environment system.

| Variable | Description | Required |
| --- | --- | --- |
| `VITE_GEMINI_API_KEY` | API key used to call the Gemini model. | Yes |
| `VITE_LLM_PROVIDER` | Optional provider override (currently `gemini`). | No |
| `VITE_LLM_MODEL` | Optional model identifier override for the selected provider. | No |
| `VITE_LLM_ENDPOINT` | Optional absolute endpoint override for advanced routing/testing. Must be a valid URL. | No |

Copy `.env.example` to `.env` at the project root for local development, then update values:

```bash
cp .env.example .env
VITE_GEMINI_API_KEY=your_api_key_here
# Optional:
# VITE_LLM_PROVIDER=gemini
# VITE_LLM_MODEL=gemini-2.5-flash-preview-09-2025
# VITE_LLM_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent
```

## Runtime Validation & Fallback
At startup, `resolveLlmConfig` validates provider/model/endpoint values.

- Missing provider/model values use the default policy (`gemini` + `gemini-2.5-flash-preview-09-2025`).
- Unsupported provider/model values fall back to the same defaults and emit warnings.
- Invalid `VITE_LLM_ENDPOINT` values are ignored; the model default endpoint is used.
- If runtime resolution produces no usable endpoint, the LLM client fails fast with a configuration error before making network calls.

## Operational Model Rollout Procedure
Use this sequence for model changes to reduce risk:

1. **Staging validation**
   - Set `VITE_LLM_MODEL` (and `VITE_LLM_ENDPOINT` only if needed) in staging.
   - Run existing integration and gameplay smoke tests that exercise case generation, jury flow, motion ruling, and verdict paths.
   - Confirm no malformed payload regressions in logs.
2. **Default model policy check**
   - Verify the default policy in `src/lib/config.js` still points to a known-good model.
   - Keep defaults stable until the staged model is validated.
3. **Production rollout**
   - Promote environment values after staging passes.
   - Monitor timeout/rate-limit/auth error rates and invalid response parsing for the first rollout window.
4. **Rollback key**
   - To rollback immediately, unset `VITE_LLM_MODEL` (and `VITE_LLM_ENDPOINT` if used) so runtime falls back to the default model policy.

## Shared Defaults
`src/lib/config.js` exports `DEFAULT_GAME_CONFIG` to seed new sessions. Update this object if the product defaults change (e.g., new jurisdiction or difficulty modes).
