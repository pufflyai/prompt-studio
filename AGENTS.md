# Repo Rules

- This is a **Lerna monorepo** managed with **Bun**. It uses **Nx caching**.
- Write **TypeScript only**.
- Use **bun**. Do not use `npm`, `yarn`, or `pnpm`.
- A task is not complete until all tests pass.

# Language

Use simple English in plans, explanations, documentation, tickets, comments, and messages.

- Write short, direct sentences.
- Use plain words instead of jargon.
- Explain technical terms that readers may not know.

# Coding Rules

Keep the project structure clean and easy to understand. Make a larger change when needed to preserve or improve that structure.

- Keep things simple
- Preserve or improve the project structure
- Start with the normal, successful case
- Add backward compatibility only when it is specifically requested
- Do not add extra checks or code for problems outside the current requirements
- Always remove old or unused code

Do not:

- Deep relative imports across packages
- Importing from `clients/*`

## First-Principles Engineering

Fix the cause, not only the visible problem. Before writing code, answer these questions:

- What caused the problem?
- What system rule is being broken?
- Which part of the system should enforce that rule?
- What is the simplest design that prevents the problem from returning?

Follow these principles:

- Think carefully before adding flags, statuses, optional fields, stored values, special cases, or compatibility code. Each one makes the system more complex.
- Add state only when existing data cannot provide it. The state must have a clear meaning, one owner, and clear rules for creating, changing, and removing it.
- Fix data flow and ownership problems directly. Do not create duplicate data that must be kept in sync.
- Change the database only when the product data truly needs to change. Do not change it only to make a bug easier to fix.
- Do not aim for the smallest code change. Aim for the simplest complete solution, even if it touches several parts of the system or removes old code.
- Fix problems in the part of the system responsible for them. Do not build a large solution for a small, local issue.
- If a solution needs a workaround flag, a special case, duplicate data, or exposes internal details between layers, reconsider the design before continuing.
- Tests should prove that the correct behavior and system rules have been restored, not preserve the details of a workaround.

If an external limit makes a workaround unavoidable, create an architecture decision record (ADR) in `.pstdio/docs/adrs` before writing the workaround. Use the next four-digit number and a kebab-case filename.

The ADR must explain:

- How the system should ideally work
- What external limitation prevents that
- Why a clean solution is currently impossible
- What workaround was chosen and what trade-offs it introduces
- How the workaround is kept isolated
- When and how the workaround should be removed

Clearly describe it as a temporary workaround, not the intended design.

## Visual Design Rules

- Pencil `.pen` designs define how the `@pstdio/ui` component library must look. This includes colors, text styles, spacing, corner roundness, component states, and layout. Make the code match the design.
- The main design system file is [`design/prompt-studio-design-system.pen`](design/prompt-studio-design-system.pen). Open and edit `.pen` files only with the Pencil MCP tools. Never edit them by hand.
- If the design and code do not match, update the code to match the design. If the design is wrong, fix it in Pencil first, then update the code.
- Storybook defines component **APIs and props**. Pencil defines how components **look**.

## Styling Rules

Build the UI with the design system. Do not create one-off styles.

- Build screens with exported `@pstdio/ui` components. Use a basic Chakra component directly only when `@pstdio/ui` has no matching component.
- Apply styles with Chakra recipes and theme tokens in `packages/ui/src/theme`. Use recipe `variant` and `size` props, semantic color tokens, `textStyles`, and `layerStyles`.
- If the current recipes and tokens cannot create a visual from the `.pen` design, add the missing variant or token to `packages/ui/src/theme`. This makes it available to every caller.

Do not use:

- Custom CSS files, `styled` wrappers, or inline `style={{ ... }}` objects for design-system styles
- Fixed colors, font sizes, spacing, or corner sizes instead of tokens
- Local style overrides that repeat styles a recipe variant should provide

## Required Workflow: Test-Driven Development

Follow these steps **every time**:

### 1. Red — Write a Test First

- Skip this step when no useful test applies.
- Reproduce a bug with Playwright or another tool before trying to fix it.
- Write the smallest test that proves the expected behavior.
- Confirm the test fails for the right reason.

Do not write:

- Tests for UI changes. Use storybook stories instead.
- Tests for changes that only affect configuration.
- Tests for changes that only affect documentation.
- Tests that assert literal bundled copy.
- Tests that assert generated file wording.

### 2. Green — Make the Test Pass

- Write only the code needed to pass the test
- Do not make the solution more general than needed
- Support the normal, successful case first

Run tests often.

### 3. Refactor — Clean Up

- Improve readability
- Delete unused or legacy code
- Add or update end-to-end tests for new features
- Keep the project structure clean
- Split growing files before they exceed 350 lines
- Update the documentation
- Remove tests that cover only implementation details

Tests must stay green.

### 4. Prove It Works (Required)

(Skip this step for changes that only affect documentation.)

Before finishing a task, run `bun run validate`. Fix every reported issue.

Always validate UI changes using Playwright.

### 5. Test Packaged Files

- If bundled runtime files change, update the packaged smoke test. These files include built-in templates, prompts, skills, and other packaged defaults.
- Keep `packages/e2e/src/packaged/packaged-serve-smoke.test.ts` in sync with the packaged files.
- Run `bun run --cwd scripts verify:packages` to check packaged output.

### 6. Changesets

> These rules apply to changes compared with `main`, not to changes made earlier on the same branch.

- Changesets apply to **`pstdio`**, **`@pstdio/sdk`**, **`@pstdio/ui`**, **`@pstdio/workbench`**, and every core extension.
- If you change a package under `packages/*` other than `sdk`, `ui`, or `workbench`, add a changeset for **`pstdio`** only.
- If you change `@pstdio/sdk`, `@pstdio/ui`, or `@pstdio/workbench`, also add a changeset for the package you changed.
- If you change extension source or assets, include a changeset for that extension.
- Add new private packages under `packages/` or `clients/` to the `ignore` list in `.changeset/config.json`. This keeps them out of releases.
- Run `bun changeset`, choose a version increase (`patch`, `minor`, or `major`), and write a **one-line changelog summary**.
- **Never change versions in `package.json` by hand**.

Do not add:

- Changesets for changes that only affect tests or code structure.

### 7. Migrations

A pull request may contain only one migration entry. If the tools create more than one, combine them into one.

## Fixing Bugs

- Always reproduce a bug before fixing it.
- Always write a test that proves the bug stays fixed.
- Always validate UI changes using Playwright.

## Git

- **Branches**: Use `<category>/<kebab-description>`. The categories are `feature`, `bugfix`, `hotfix`, `test`, and `chore`. Example: `feature/add-new-event-button`.
- **Commits**: Use `<category>(<PS-XXX>): <statement>; <statement>`. The categories are `feat`, `fix`, `refactor`, and `chore`. Each statement must finish the sentence "This commit will..." Example: `fix(PS-42): add new button component; add new button to templates`.
- **Pull requests**: Open them as drafts against `main` unless the user says otherwise. Use `<category>(<PS-XXX>): <statement>` for the title. Example: `fix(PS-42): add new button component`.

## Coding Style Rules

- Put content that may grow, such as endpoints and schemas, in separate files
- Every file must stay below about **350 lines**
- Use pure functions when possible
- Use comments to explain **why**, not what the code does
- Let TypeScript infer return types; do not write them yourself
- Do not nest ternary expressions

### Database Migrations

- Never create or edit Drizzle migration SQL files by hand.
- For a schema change, update the schema source first. Then generate the migration with the package script, such as `bun run --cwd packages/pstdio-db db:generate`.
- If a generated migration is wrong, fix the schema or the generation setup and generate it again. Do not edit the migration SQL by hand.

### React Rules

- Do not use `memo()`, `useCallback()`, or `useMemo()`. The React compiler handles this work.
- Put complex prop definitions in an interface.
- Destructure props **inside** the function.
- Use components instead of `render*` helper functions. Move extracted UI logic into a component.
- Use kebab-case for component file names, such as `my-component.tsx`.
- Never use the `NativeSelect` component.

### Testing Rules

- Put each test **next to the file it tests**.
- Avoid mocks. Test real behavior when possible.
- For a bug fix, add a test that reproduces the bug before changing the code.
- Test behavior that users can use and rules the product still supports.
- When removing a feature, delete or update its tests. Do not add tests that only prove the feature is gone.
- Write failure-case tests only for rules the product still supports, such as validation, permissions, and error handling. Never use them to prove deleted code stays gone.

Do not write:

- Tests for UI changes. Use storybook stories instead.
- Tests for changes that only affect configuration.
- Tests for changes that only affect documentation.
- Tests that assert literal bundled copy.
- Tests that assert generated file wording.
- Tests that only prove a removed feature, command, or setting stays absent.

# Running and Validating the App

- **Never** run the dev server directly.
- **Never** connect directly to the local PGlite database.
- **Always** run the Docker version with `bun run dev:isolated`. This keeps the database isolated.

## Manual Playwright Validation

Run `bun run dev:playwright`. Open the dashboard URL printed by the command with Playwright or another browser tool. When finished, stop it with `bun run dev:playwright:down`.

## CI Timeouts

A CI timeout is a fixed performance limit. If a job reaches that limit, something became slower. Treat the slowdown as the bug.

**Never increase a timeout without clear approval for that exact value in the same conversation.** This rule still applies when a timeout increase is the only way to make the check pass. It covers:

- `timeout-minutes` in any `.github/workflows/` job
- the suite-wide defaults in `packages/e2e/playwright.config.ts` (`timeout`, `expect.timeout`, `webServer.timeout`)
- limits for a whole test: `test.slow()` and `test.setTimeout()`

If a job times out, report what became slower and by how much. Then fix the slowdown or ask the user what to do. Do not hide the problem by raising the limit.

---

# Project Planning and Documentation

- Use the pstdio command-line tool to manage tickets.
- After editing a ticket, save it with `pst tickets save --id PS-XXX`.
- Run `pst --help` for help.
- When the user asks you to edit `extensions`, do not update the templates in `packages/pstdio/files`.
