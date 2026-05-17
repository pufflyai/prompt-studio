# ADR: Unified Test Runner — bun test

## Decision

Remove vitest from the monorepo. Use `bun test` as the single test runner for all unit and integration tests. Use `test-storybook` for Storybook interaction tests.

## Context

The monorepo used two test frameworks:

- **bun test** — 7 packages (pstdio, pstdio-api, pstdio-db, pstdio-wt, pstdio-storage, pstdio-agents, landing-page)
- **vitest** — 2 packages (ui, pstdio-dashboard)

The vitest usage was minimal:

- `packages/pstdio-dashboard` had one test file importing from `"vitest"` with no vitest-specific APIs
- `packages/ui` used `@storybook/addon-vitest` to auto-generate smoke tests from stories and run them in headless Chromium

Maintaining two test frameworks adds unnecessary tooling complexity.

## What changes

| Before                                          | After                                            |
| ----------------------------------------------- | ------------------------------------------------ |
| `vitest` for dashboard unit tests               | `bun test`                                       |
| `@storybook/addon-vitest` for story smoke tests | `test-storybook` CLI against a running Storybook |
| Two test frameworks to maintain                 | One (`bun test`) + Storybook's own test runner   |

## Trade-offs

### Lost: automatic smoke tests for all stories

The vitest addon treated every exported story as a smoke test (render without crashing). `test-storybook` only runs stories that have a `play` function. Stories without `play` are not tested.

Mitigation: add `play` functions to stories that cover important components. See [Storybook Play Coverage](/contributing/storybook-play-coverage).

### Lost: vitest watch mode integration

The addon re-ran affected story tests on HMR changes. `test-storybook` runs the full suite against a built or running Storybook.

### Gained: single test framework

One runner, one set of APIs (`bun:test`), one configuration pattern across all packages.

### Gained: simpler CI

No vitest binary, no browser provider setup. `test-storybook` runs against the same Storybook build already produced for deployment.

## Storybook testing workflow

```bash
# Development
bun run storybook          # start dev server
bun run test-storybook     # run interaction tests against it

# CI
bun run build-storybook    # build static storybook
npx http-server storybook-static -p 6006 &
bun run test-storybook --url http://localhost:6006
```
