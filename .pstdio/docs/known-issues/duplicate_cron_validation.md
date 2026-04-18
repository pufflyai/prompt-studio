# Duplicate Cron Validation

## Problem

Cron expression validation currently lives in two places:

1. `packages/sdk/src/plugins/define-plugin.ts`
2. `packages/pstdio-plugins/src/loader.ts`

Both validate 5-field cron syntax with similar logic.

## Why this exists

- SDK-side validation catches invalid plugin definitions when plugin authors use `definePlugin(...)`.
- Loader-side validation protects runtime loading, including plugin modules that do not use `definePlugin(...)`.

## Risk

If one validator changes and the other does not, behavior can drift.

## Future Improvement

Extract cron validation into a shared utility used by both SDK and loader paths so validation behavior stays consistent.
