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
3. During development, use the smallest scope that covers the changed behavior, including affected callers or integration checks across package boundaries. After a run reports failures, use the batched repair cycle in section 9.

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
3. Fix reported issues together and rerun only failed tests during the repair loop. Add the regression tests needed for those fixes. Recompute the targeted plan for changed inputs; do not repeat unrelated passing suites after each repair.
4. For documentation-only changes, check content, links, paths, and formatting. Do not run application tests or full validation merely because a documentation path appears in a source comment, prompt, or test fixture.
5. Require browser or visual checks only for critical risks: a blocked primary task, hidden essential content or controls, broken keyboard or focus behavior, preview isolation, or a critical regression.
6. Use the smallest representative browser scenario. Add screenshot comparisons only when appearance is the critical contract and behavioral assertions cannot establish it.
7. Routine copy, spacing, cosmetic, and documentation changes do not require browser runs or screenshots. Explicit user-requested visual verification still applies.

## 5. Packaged files

1. When bundled runtime behavior, assets, or file inclusion change, update the relevant packaged smoke test. This includes built-in templates, prompts, skills, and other packaged defaults. Documentation-reference-only edits do not require packaged tests.
2. Keep `packages/e2e/src/packaged/packaged-serve-smoke.p2.test.ts` in sync with packaged files.
3. Use packaged verification only for exceptional changes with a concrete installation, distribution or packaged-runtime risk that focused source checks cannot establish, or an explicit user request. Select the smallest complete owning workload and retain latest-commit evidence. Do not run the full `bun run --cwd scripts verify:packages` command for routine PRs.

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
12. Demo/example extensions and repository-local tools do not carry automated test suites or app journeys. Test platform behavior with minimal fixtures, without exercising demo application features.
13. Keep production extension suites focused on their own behavior and runnable with their declared public dependencies and extension-owned setup. Avoid installing unrelated extensions or starting the complete host for unit tests.

## 7. Test commands

1. For one test file, run `bun test <path>` from its package directory.
2. For one package, run `bun run --cwd packages/<name> test`.
3. For one UI E2E spec, run `bun run --cwd packages/e2e test:ui -- src/ui/<name>.spec.ts`.
4. Run a priority group with `bun test:p0`, `bun test:p1`, `bun test:p2`, or `bun test:p3`. Use `--scope <workspace>` and `--runner <kind>` for targeted work.
5. Discovery owns test-group membership. Do not add filename lists to workflows.
6. Before review readiness, use `bun run test:review` and [PR completion](0004-ci.md#1-finishing-a-pull-request). Run the full local suite only when explicitly requested; it is not the default after implementation, repairs, or merging main.
7. Do not run `bun run validate` unless the user explicitly asks for full validation.

## 8. App isolation and manual validation

1. Never run the dev server directly or connect directly to the local PGlite database.
2. Always run the Docker version with `bun run dev:isolated` to isolate the database.
3. For manual browser validation, run `bun run dev:isolated -- --name <unique-run-id>` and open its printed dashboard URL with Playwright or another browser tool. Each run owns a unique stack name.
4. When manual validation finishes, stop only that stack with `bun run dev:isolated -- --name <unique-run-id> --down`. Do not reuse or stop another agent’s stack.

## 9. Targeted validation and repairs

1. Finish implementation and settle known fixes before review validation. Use focused red/green checks during development. Commit the candidate before `bun run test:review`; the command validates an immutable disposable checkout of that revision.
2. Use the complete merge-queue test selection as the minimum local review workload: all fast repository/package P0, affected P1 source contracts and service integrations, the canonical dashboard smoke, packaged desktop smoke and affected packaged flows. Derive membership from the queue planner and owning runners, not a separate filename list. Add affected contracts, added or edited tests, and the smallest additional scenarios needed to cover changed behavior. Include affected callers, permissions, persistence, lifecycle and integration boundaries. Test discovery owns membership. A changed helper, fixture or runner can affect tests whose files did not change.
3. Inspect the plan with `bun run test:review --list`. Add relevant existing scenarios with `--test <repository-relative-file>`; additions never remove automatic coverage. Queue-selected tests always run locally, including service integrations and smoke. A deferred inventory is not a request to run complete matrices. Native, packaged and benchmark workloads outside the queue minimum run only under the exceptional-check policy in [PR completion](0004-ci.md#1-finishing-a-pull-request); their normal complete coverage belongs to nightly and release validation. A missing Docker daemon or browser prerequisite fails the local run; it never shrinks the queue minimum. Retain evidence for explicitly required exceptional checks. Do not dispatch `ci:full` or benchmark diagnostics merely because ordinary PR CI omits unedited suites.
4. Keep one failure list with revision, command, failed case or file, elapsed time and evidence. Failed, blocked, interrupted, deferred and unrun work never counts as passing. Aim for 15 minutes for routine local review. Broad changes run every selected check to completion even when they exceed that target; report the overrun and slow phases. Elapsed time alone never cancels or reduces coverage. Explicit interruption still stops owned processes and preserves partial evidence; individual test and benchmark limits remain unchanged.
5. Repair failures together. Rerun failed tests and new regressions through their owning runners. Run blocked checks after their prerequisites are fixed. Preserve the first failure; retrying unchanged source does not resolve it. Reuse passing results only when their inputs remain unchanged, recording the original revision and scope honestly.
6. Local runs own their checkout, installed dependencies, build output, runtime homes, ports and reports. Completed Nx build archives may be reused through the local review cache; indexes and restored outputs remain private, and test results are never reused. Compose launchers register exact per-run project names and retained configurations; after stopping test processes, the supervisor removes those projects and records cleanup failures. Docker allocates each network automatically. Use bounded runner concurrency. Heavy full suites and performance measurements belong on isolated CI hosts.
7. Batch repairs before pushing. Normal latest-head CI remains required; do not manually rerun passing jobs. When full local validation is explicitly requested, use the [collect-all commands](../guides/development/0002-testing.md#complete-a-full-test-run-without-stopping-at-the-first-failure) and preserve all results. No final full rerun is required by default.
