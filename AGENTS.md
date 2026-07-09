# Repo Rules

- **Lerna + Bun-managed monorepo** with **Nx caching**. **TypeScript only**.
- Use **bun**, do not use `npm`, `yarn`, or `pnpm`.
- Your work is not done until all tests are passing.

# Coding Rules

Never compromise the project structure. Code readability and structure matters most, and we're happy to make bigger changes to achieve it:

- Keep things simple
- Preserve or improve the project structure
- Assume the happy path first
- Avoid backwards compatibility unless specifically requested
- Do not add defensive or speculative code
- Always cleanup legacy or unused code (boy scout rule)

❌ Not allowed:

- Deep relative imports across packages
- Importing from `clients/*`

## Required Workflow: TDD

Follow this loop **every time**:

### 1. Red — Write the test first

- Skip if no valid test is applicable.
- Use Playwright or other tools to reproduce a bug before attempting to fix it.
- Write the smallest test that proves the behavior.
- Confirm the test fails for the right reason.

❌ Not allowed:

- Tests for UI changes. Use storybook stories instead.
- Tests for config only changes.
- Tests for documentation only changes.
- Tests that assert literal bundled copy.
- Tests that assert generated file wording.

### 2. Green — Make it pass

- Write the **minimum** code needed
- No generalization
- Happy path only

Run tests often.

### 3. Refactor — Clean up

- Improve readability
- Delete unused or legacy code
- Add / Update e2e tests for new features
- Ensure project structure is preserved
- Split files early if they grow (350 lines max)
- Update documentation
- Remove tests that cover only implementation details

Tests must stay green.

### 4. Prove It Works (Required)

(Skip this for documentation only changes.)

Before completing a task run `bun run validate`. Ensure it passes. Fix any remaining issues.

Always validate UI changes using Playwright.

### 5. Packaged Artifacts Smoke Test

- If bundled runtime artifacts change (for example embedded templates, prompts, skills, or other packaged defaults), update packaged smoke-test expectations accordingly.
- Keep `packages/e2e/src/packaged/packaged-serve-smoke.test.ts` aligned with the current bundled artifact set.
- When validating packaged output, run `bun run --cwd scripts verify:packages`.

### 6. Changesets

> NOTE: the following applies to changes relative to main, not within the same branch.

- Changesets are scoped to: **`pstdio`**, **`@pstdio/sdk`**, **`@pstdio/ui`**, **`@pstdio/workbench`**, and all core extensions.
- If you modify any of `packages/*` (other than `sdk`, `ui`, or `workbench` themselves), include a changeset for **`pstdio`** only.
- If `@pstdio/sdk`, `@pstdio/ui`, or `@pstdio/workbench` itself changes, include a changeset for that package too.
- If you change extension source or assets, include a changeset for that extension.
- New private packages under `packages/` or `clients/` must be added to `.changeset/config.json` `ignore` to stay out of the release flow.
- Run `bun changeset`, choose the semver bump (`patch`, `minor`, `major`), and write a **one-line changelog summary**.
- **Do not manually edit `package.json` versions**.

❌ Not allowed:

- Changesets for tests and refactor only changes.

### 7. Migrations

Only a single migration entry is allowed per PR. Group them into one if more than one is generated.

## Fixing Bugs

- Always reproduce an issue before fixing it.
- Always write a regression test to prevent it from happening again.
- Always validate UI changes using Playwright.

## Git

- **Branches**: `<category>/<kebab-description>` — categories: `feature`, `bugfix`, `hotfix`, `test`, `chore` (e.g. `feature/add-new-event-button`)
- **Commits**: `<category>(<PS-XXX>): <statement>; <statement>` — categories: `feat`, `fix`, `refactor`, `chore`. Each statement should complete "This commit will…" (e.g. `fix(PS-42): add new button component; add new button to templates`)
- **Pull Requests**: open against `main` as drafts unless otherwise specified. Names should follow `<category>(<PS-XXX>): <statement>` (e.g. `fix(PS-42): add new button component`).

## Coding Style Rules

- Split content that will grow in separate files (endpoints, schemas, etc.)
- Files **MUST** stay under **~350 lines**
- Prefer pure functions
- Comment **WHY**, not WHAT
- Do **not** specify return types — let TypeScript infer
- Avoid nested ternaries

### Database Migrations

- Do **not** create or edit Drizzle migration SQL files manually.
- For schema changes, update the schema source first, then generate migrations with the package script, e.g. `bun run --cwd packages/pstdio-db db:generate`.
- If a generated migration is wrong, fix the schema or generation setup and regenerate it; do not hand-patch migration SQL.

### React Rules

- Do **not** use `memo()`, `useCallback()` or `useMemo()` (we use the react compiler)
- Extract complex props into an interface
- Destructure props **inside** the function
- Prefer components over `render*` helper functions; when UI logic needs extracting, move it into a component instead of a render function
- Component file names in kebab-case "my-component.tsx"
- Never use the NativeSelect component

### Testing Rules

- Tests must be **located next to the file they test**.
- Avoid mocks, test the real thing when possible.
- Bug fixes must add a regression test first.
- Test supported user-facing behavior and active contracts.
- When removing a feature, delete or update its tests — do not replace them with absence tests.
- Negative tests only for active contracts (validation, permissions, error handling), never to prove deleted code stays gone.

❌ Not allowed:

- Tests for UI changes. Use storybook stories instead.
- Tests for config changes.
- Tests for documentation changes.
- Tests that assert literal bundled copy.
- Tests that assert generated file wording.
- Tests that assert a removed feature/command/setting stays absent.

# Validation flows

- **Never** run the dev server directly.
- **Never** connect to the local pglite db directly.
- **Always** run the dockerized version: `bun run dev:isolated` to ensure db isolation.

## Manual Playwright validation

Run `bun run dev:playwright`, open the printed dashboard URL with Playwright or browser automation, and stop it with `bun run dev:playwright:down`.

---

# Project Planning and Documentation (pstdio)

This project uses the pstdio CLI to manage tickets.
After editing tickets, make sure to save them using `pst tickets save --id PS-XXX`.
Run `pst --help` to learn more.
When asked to edit `extensions` do not update the templates in `packages/pstdio/files`.
