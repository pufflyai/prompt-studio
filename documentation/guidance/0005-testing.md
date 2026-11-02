# Testing and validation

## 1. Red: write a test first

1. Follow the red, green, and refactor workflow for every change. Skip a test only when no useful test applies.
2. Reproduce a bug with Playwright or another tool before fixing it.
3. For a meaningful behavioral bug, write the smallest regression test that proves the expected behavior before changing code.
4. Confirm the test fails for the right reason.
5. Use the critical-risk policy in section 4 for visual-only bugs.

## 2. Green: make the test pass

1. Write only the code needed to pass the test. Do not generalize beyond the requirement.
2. Support the normal, successful case first.
3. Run tests often, using only the smallest scope that covers the changed behavior. Include affected callers or integration checks when crossing package boundaries.

## 3. Refactor

1. Improve readability, delete unused or legacy code, and keep the project structure clean.
2. Split growing source files before they exceed about 350 lines. See [source-file limits](0006-engineering.md#4-code-style) for exemptions.
3. Add or update end-to-end tests for new features, update documentation, and remove tests that cover only implementation details.
4. Keep tests green.
5. CI runs each test once per applicable platform. Never repeat tests, retry failures, or run repeated reliability checks to obtain a pass.
6. Quarantine confirmed flakes with evidence, an owner, and removal criteria. Run them once in a separate lane and require its execution report.

## 4. Prove it works

1. A task is incomplete until the relevant tests and checks pass.
2. For code changes, run targeted tests and relevant package checks such as type checking, linting, or a build. Match checks to affected behavior and dependencies.
3. Fix reported issues and rerun only failed or affected checks. Do not repeat passing checks without a new change or unresolved concern.
4. For documentation-only changes, check content, links, paths, and formatting. Do not run application tests or full validation merely because a documentation path appears in a source comment, prompt, or test fixture.
5. Require browser or visual checks only for critical risks: a blocked primary task, hidden essential content or controls, broken keyboard or focus behavior, preview isolation, or a critical regression.
6. Use the smallest representative browser scenario. Add screenshot comparisons only when appearance is the critical contract and behavioral assertions cannot establish it.
7. Routine copy, spacing, cosmetic, and documentation changes do not require browser runs or screenshots. Explicit user-requested visual verification still applies.

## 5. Packaged files

1. When bundled runtime behavior, assets, or file inclusion change, update the relevant packaged smoke test. This includes built-in templates, prompts, skills, and other packaged defaults. Documentation-reference-only edits do not require packaged tests.
2. Keep `packages/e2e/src/packaged/packaged-serve-smoke.p2.test.ts` in sync with packaged files.
3. For runtime or package changes, run `bun run --cwd scripts verify:packages`.

## 6. Test design

1. Name test files and suite titles after the feature or behavior. Do not prefix them with ticket IDs.
2. Declare one priority in every maintained test filename, such as `session.p0.test.ts` or `startup.p1.spec.ts`. See [test priorities](../guides/development/0015-ci-stages.md#test-priorities).
3. Put each test next to the file it tests.
4. Avoid mocks. Test real behavior when possible.
5. Test behavior users can use and rules the product still supports.
6. When removing a feature, delete or update its tests. Do not add tests that only prove a removed feature, command, or setting stays absent.
7. Write failure-case tests only for supported rules such as validation, permissions, and error handling.
8. Do not write exhaustive UI permutations or cosmetic-only assertions. Use Canvas for exploration. Automate browser checks only for a critical behavior and name the risk in the test.
9. Do not write tests for changes that only affect configuration or documentation.
10. Do not assert literal bundled copy or generated file wording.
11. Do not keep tests that cover only implementation details.

## 7. Test commands

1. For one test file, run `bun test <path>` from its package directory.
2. For one package, run `bun run --cwd packages/<name> test`.
3. For one UI E2E spec, run `bun run --cwd packages/e2e test:ui -- src/ui/<name>.spec.ts`.
4. Run a priority group with `bun test:p0`, `bun test:p1`, `bun test:p2`, or `bun test:p3`. Use `--scope <workspace>` and `--runner <kind>` for targeted work.
5. Discovery owns test-group membership. Do not add filename lists to workflows.
6. Run all tests only when the feature is ready, before marking the PR ready. Follow [PR completion](0004-ci.md#1-finishing-a-pull-request).
7. Do not run `bun run validate` unless the user explicitly asks for full validation.

## 8. App isolation and manual validation

1. Never run the dev server directly or connect directly to the local PGlite database.
2. Always run the Docker version with `bun run dev:isolated` to isolate the database.
3. For manual browser validation, run `bun run dev:playwright` and open its printed dashboard URL with Playwright or another browser tool.
4. When manual validation finishes, stop it with `bun run dev:playwright:down`.
