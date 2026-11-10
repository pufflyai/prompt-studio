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
3. During development, use the smallest scope that covers the changed behavior, including affected callers or integration checks across package boundaries. After a full run reports failures, use the batched repair cycle in section 9.

## 3. Refactor

1. Improve readability, delete unused or legacy code, and keep the project structure clean.
2. Split growing source files before they exceed about 350 lines. See [source-file limits](0006-engineering.md#4-code-style) for exemptions.
3. Add or update end-to-end tests for new features, update documentation, and remove tests that cover only implementation details.
4. Keep tests green.
5. CI runs each test once per applicable platform. Never retry unchanged failures or run repeated reliability checks to obtain a pass. Verify cause repairs and the final revision through section 9.
6. Quarantine confirmed flakes with evidence, an owner, and removal criteria. Run them once in a separate lane and require its execution report.

## 4. Prove it works

1. A task is incomplete until the relevant tests and checks pass.
2. For code changes, run targeted tests and relevant package checks such as type checking, linting, or a build. Match checks to affected behavior and dependencies.
3. Fix reported issues together and rerun only failed tests during the repair loop. Add the regression tests needed for those fixes. Once that set is green, complete the final full run required by section 9; do not repeat passing suites after each repair.
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
6. Run all tests only when the feature and known review fixes are ready. Follow section 9 and [PR completion](0004-ci.md#1-finishing-a-pull-request).
7. Do not run `bun run validate` unless the user explicitly asks for full validation.

## 8. App isolation and manual validation

1. Never run the dev server directly or connect directly to the local PGlite database.
2. Always run the Docker version with `bun run dev:isolated` to isolate the database.
3. For manual browser validation, run `bun run dev:playwright` and open its printed dashboard URL with Playwright or another browser tool.
4. When manual validation finishes, stop it with `bun run dev:playwright:down`.

## 9. Full-suite validation cycle

1. Finish implementation, integrate required dependencies, and settle known review fixes before starting a full run. Integrate `main` only for merge conflicts or more than 10 incoming commits, as defined by [the CI rule](0004-ci.md#1-finishing-a-pull-request). Use focused red/green checks during development. Keep the tested source and build outputs unchanged while a run uses them.
2. Run the complete required workload even when tests fail. Disable fail-fast for this run and continue independent phases after a failure. Use the [collect-all commands](../guides/development/0002-testing.md#complete-a-full-test-run-without-stopping-at-the-first-failure); `bun run test` alone stops early on failure. A failed build can block dependent tests; record them as unrun and finish independent work. Honor an explicit stop request and report interruptions accurately.
3. Keep one failure list with source revision, command, failed case or file, result, elapsed time and evidence. Collect every phase's result before planning the repair batch. Failed, blocked, interrupted and unrun work never counts as passing.
4. Triage the complete list and fix all actionable failures together. Keep unrelated repairs in their own tickets/PRs under [the CI rules](0004-ci.md#1-finishing-a-pull-request), with their failures visible. Do not fix one failure, restart the full suite, and discover the next failure in another long run.
5. Rerun only the failed tests and new regressions after their causes are repaired. Run blocked or unrun scopes once their prerequisites are repaired. Use the smallest supported case/file selection; use the whole owning scope only when it cannot be split, including fixed benchmark workloads. Keep narrowing the failed set without rerunning already passing suites. A rerun without a cause repair is a retry, not validation.
6. When the failed set is green, run the complete required workload once on the final revision. If it exposes new failures, add them to the list and repeat the repair cycle before another full run. One complete green run on that revision ends validation; do not repeat it for reassurance.
7. Run one heavy local validation workload at a time on the shared machine. Account for other agents' runs and runner-owned worker pools; do not overlap full suites, package verifiers, large builds or benchmarks. Reuse valid completed results during repair and interruption recovery. Repeat a passed build or separate verifier only when its inputs changed or the final workload requires it.
8. Batch repairs before pushing so each small fix does not trigger another CI run. Let normal CI validate the new commit; do not manually rerun passing jobs or restart an entire workflow to repair one failed job. Wait for all applicable latest-head checks and retain first-failure evidence. This cycle does not authorize retries, smaller workloads, more workers or higher limits.
