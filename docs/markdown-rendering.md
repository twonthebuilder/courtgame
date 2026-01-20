# Markdown Rendering (Arguments)

Pocket Court supports a **minimal, internal Markdown subset** for player-submitted arguments (motions, rebuttals, and closing arguments). The goal is to provide readable formatting while keeping rendering deterministic and safe.

## Supported Markdown Subset

Only the following syntax is recognized:

- **Headings:** `#`, `##`, `###`, `####` (rendered as progressively smaller headings).
- **Lists:** unordered (`-` or `*`) and ordered (`1.`, `2.`, ...).
- **Emphasis:** `*italic*` and `**bold**`.
- **Code blocks:** fenced blocks using triple backticks (```` ``` ````).

All other Markdown syntax is treated as plain text.

## Rendering Constraints

- Inline styling is limited to emphasis tokens (`*`, `**`); links, images, tables, blockquotes,
  task lists, and inline code are not parsed.
- Nesting is shallow by design; lists do not support embedded headings or mixed ordered/unordered
  blocks inside the same list.
- Markdown is parsed line-by-line; any unsupported tokens remain visible as literal text.

## Sanitization & Safety

- The renderer **does not** parse raw HTML.
- All content is rendered via React elements without `dangerouslySetInnerHTML`.
- Any HTML-like input (e.g., `<script>`) is displayed as text and is not executed.
- Unsupported Markdown tokens are ignored and shown verbatim.

This approach keeps formatting predictable while preventing script injection or unsafe markup.
