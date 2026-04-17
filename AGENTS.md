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

(skip if no valid test is applicable)

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

### 5. Packaged Artifacts Smoke Test

- If bundled runtime artifacts change (for example embedded templates, prompts, skills, or other packaged defaults), update packaged smoke-test expectations accordingly.
- Keep `packages/e2e/src/packaged/packaged-serve-smoke.test.ts` aligned with the current bundled artifact set.
- When validating packaged output, run `bun run scripts/verify-packages.ts`.

# 6. Changesets

> NOTE: the following applies to changes relative to main, not within the same branch.

- If you modify **any package**, include a changeset for **`pstdio`** only; include **`@pstdio/ui`** or **`@pstdio/sdk`** only when those packages themselves change.
- Run `bun changeset`, choose the semver bump (`patch`, `minor`, `major`), and write a **one-line changelog summary**.
- **Do not manually edit `package.json` versions**.

❌ Not allowed:

- Changesets for tests and refactor only changes.

## Fixing Bugs

- Always reproduce an issue before fixing it.
- Always write a regression test to prevent it from happening again.

## Coding Style Rules

- Split content that will grow in separate files (endpoints, schemas, etc.)
- Files **MUST** stay under **~350 lines**
- Prefer pure functions
- Comment **WHY**, not WHAT
- Do **not** specify return types — let TypeScript infer
- Avoid nested ternaries

### React Rules

- Do **not** use `memo()`, `useCallback()` or `useMemo()` (we use the react compiler)
- Extract complex props into an interface
- Destructure props **inside** the function
- Prefer components over `render*` helper functions; when UI logic needs extracting, move it into a component instead of a render function
- Component file names in kebab-case "my-component.tsx"

### Testing Rules

- Tests must be **located next to the file they test**.
- Avoid mocks, test the real thing when possible.
- Bug fixes must add a regression test first.

❌ Not allowed:

- Tests for UI changes. Use storybook stories instead.
- Tests for config changes.
- Tests for documentation changes.
- Tests that assert literal bundled copy.
- Tests that assert generated file wording.

---

# Project Planning and Documentation (pstdio)

This project uses `pstdio` to manage tickets and documentation.

Run `pstdio --help` to learn more.

When asked to edit `plugins` do not update the templates in `pstdio/files`.

---
