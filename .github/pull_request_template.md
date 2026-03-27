## What changed
<!-- One sentence -->

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Docs / config

## Checklist
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes
- [ ] New lib/ functions have unit tests
- [ ] New API routes have integration tests and use withMonitoring()
- [ ] New env vars added to .env.example and docs/env-vars.md
- [ ] New migration → docs/STATE.md updated, db:gen-types run
- [ ] No country names in types, components, or copy

## Processing pipeline changes (if applicable)
- [ ] Soft skips store skip_reason on the row
- [ ] Hard failures call logger.error() with context
- [ ] No finalizeSuccess() on Zod parse failure

## Cursor review
- [ ] Ran: "Use .cursor/prompts/pr-review.md to review this branch against dev"
- [ ] All blocking issues resolved

## Flow tag (if new API route)
`flow: lead-capture | processing | qualification | handoff | admin | preview`
