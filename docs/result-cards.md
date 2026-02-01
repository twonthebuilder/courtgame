# Result cards (verdicts, rulings, sanctions)

Pocket Court result displays should use a consistent card pattern to keep end-of-phase
summaries readable across screen sizes.

## Component

Use the shared `ResultCard` component:

```
import ResultCard from '../shared/ResultCard';
```

The component provides the standard border, padding, and title styling. Wrap the
distinct result content (verdicts, rulings, sanctions) inside the card so each
decision is visually separated and text can wrap cleanly.

## Recommended structure

- One card per result item (judge opinion, jury reasoning, judge ruling, sanctions summary).
- Keep the card title in the `title` prop; render body text inside.
- Use `break-words` on long text content to prevent layout overflow.

## Examples

```jsx
<ResultCard title="Judge's Opinion">
  <ExpandableText
    text={result.judge_opinion}
    className="font-serif text-slate-700 text-sm break-words"
  />
</ResultCard>
```

```jsx
<ResultCard title="Sanctions & Status Updates">
  <ul className="space-y-2 text-sm text-slate-600">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
</ResultCard>
```
