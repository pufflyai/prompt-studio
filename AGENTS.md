# Guidance for Coding Agents working in this repository.

---

🚨 **THIS REPO IS UNDER CONSTRUCTION.** 🚨

- BACKWARDS COMPATIBILITY IS NOT NEEDED
- BREAKING CHANGES ARE OK
- REMOVE LEGACY / UNUSED CODE
- MANY AGENTS WORK ON THIS REPO AT THE SAME TIME

---

This file answers two questions:

1. **How this repo is organized**
2. **How to write and verify code here**

## PART 1 — REPO-SPECIFIC RULES

### Repository Type

- **Bun-managed monorepo**
- **Lerna + Bun workspaces**
- **Nx caching**
- **TypeScript only**

### Repo Rules

#### Tooling

- ✅ Use **Bun**
- ❌ Do not use `npm`, `yarn`, or `pnpm`

#### Imports

✅ Allowed:

```ts
import { foo } from "<workspace-package>";
```

❌ Not allowed:

- Deep relative imports across packages
- Importing from `apps/*`
- Imports anywhere except the top of the file

## PART 2 — CODING & TESTING RULES

### Default Behavior

We want the simplest change possible, without compromising the project structure. Code readability matters most, and we're happy to make bigger changes to achieve it:

- Keep things simple
- Preserve or improve the project structure
- Assume the happy path first
- Do not add defensive or speculative code
- **Delete legacy code** in the area you are editing

### Required Workflow: TDD

Follow this loop **every time**:

#### 1. Red — Write the test first

Write the smallest test that proves the behavior:

- Unit tests → pure logic
- Integration tests → API / DB
- UI tests → Storybook stories
- E2E tests → full system flows

For visual-only changes, do **not** add test files. Use Storybook stories (and interactions when useful) as the Red step.

Confirm the test fails for the right reason.

#### 2. Green — Make it pass

- Write the **minimum** code needed
- No generalization
- Happy path only

Run tests often.

#### 3. Refactor — Clean up

- Improve readability
- Delete unused or legacy code
- Split files early if they grow (350 lines max)

Tests must stay green.

#### 4. Prove It Works (Required)

Every change must include **verifiable proof**.

Proof must be:

- Referenced in the task or PR

Include:

- Exact commands run
- Observable output:
  - test output
  - logs
  - screenshots / videos / traces
  - HTTP responses (`curl`)

An LLM or human must be able to verify the change by:

1. Running the commands
2. Inspecting the artifacts

### Required Validation Commands

After **any** code change, run **all** of these in order:

```bash
bun run format
bun run lint
bun run build
bun run test
```

If the change affects UI, API, or E2E:

- Include Storybook builds or interactions
- Include `curl` requests towards the API + responses
- Include E2E artifacts (screenshots/videos/traces)

### Coding Style Rules

#### General

- Files **MUST** stay under **~350 lines**
- Prefer pure functions
- Comment **WHY**, not WHAT
- Do **not** specify return types — let TypeScript infer
- Do **not** use `void` when calling functions
- Avoid nested ternaries

Split content that will grow in separate files, e.g. Instead of placing all endpoints in a single file, split it by endpoint: `api/<endpoint-1>`.

### React Rules

- Do **not** use `memo()`, `useCallback()` or `useMemo()` (we use the react compiler)
- Extract complex props into an interface
- Destructure props **inside** the function
- Component file names in kebab-case "my-component.tsx"

### Testing Rules

- When adding new features, an E2E test must be added as well covering all new flows. Update existing flows that are affected by the change.
- Tests must be **located next to the file they test**
- Avoid mocks, test the real thing when possible
- Control time where needed
- Bug fixes must add a regression test first
- Visual-only UI/component changes must use Storybook stories instead of adding test files, add automated tests only when UI changes include non-visual behavior or logic changes

### API Changes

When changing APIs:

- Update documentation
- Update OpenAPI / SDK types if needed
- Record **WHY** in an ADR if the decision is non-obvious
- Provide proof in artifacts:
  - `curl` requests + responses
  - logs showing handler execution
