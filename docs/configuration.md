# Pocket Court Configuration

## Overview
Pocket Court centralizes shared configuration in `src/lib/config.js`, including the API key, difficulty options, jurisdictions, and default game state. This keeps UI selectors and runtime behavior aligned in one place.

## Environment Variables
The Gemini API key is read from Vite's environment system.

| Variable | Description | Required |
| --- | --- | --- |
| `VITE_GEMINI_API_KEY` | API key used to call the Gemini model. | Yes |

Copy `.env.example` to `.env` at the project root for local development, then update the value:

```bash
cp .env.example .env
VITE_GEMINI_API_KEY=your_api_key_here
```

## Shared Defaults
`src/lib/config.js` exports `DEFAULT_GAME_CONFIG` to seed new sessions. Update this object if the product defaults change (e.g., new jurisdiction or difficulty modes).
