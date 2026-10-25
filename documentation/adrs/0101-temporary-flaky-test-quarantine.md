# Temporary flaky test quarantine

Proposed: 2026-10-23

## Decision

Keep supported behavior tests, including upgrades that preserve local data. Separate confirmed intermittent failures from the stable CI gate while continuing to execute them on every applicable full run. The user requested quarantine and ten independent full validations on 2026-10-23.

`scripts/ci/test-quarantine.json` owns the exact case names, affected platforms, responsible area, failure evidence, and removal criteria. Bun package runners, compiled CLI checks, and the packaged Playwright configuration use that same register. Only the registered test execution steps allow failures. Quarantine verification remains required: setup, builds, missing reports, skipped cases, and retries still fail CI. A separate report check verifies that every registered case executed once and publishes its failure count in the job summary. Unknown failed or cancelled jobs still fail the gate.

## External limitation

Hosted runner cold-start variance has exceeded existing execution allowances in database upgrade and Changesets CLI fixtures. Chromium editing previews have also failed intermittently after reload. The exact remaining causes have not been established. Retrying a passing case does not establish reliability. Increasing limits without explicit approval would violate the repository's time-limit rule.

Repeated runs also exposed WebKit extension routing and settings-close failures,
Windows compiled Codex and browser-validation timeouts, and a Windows session
completion race. Each case remains executable with its original assertions and
limits; the register links the failing runs. Compiled CLI quarantine uses the same
binary produced by the native toolchain job.

The repeated runs also found Apple Silicon project-tab lifecycle variance: the same commit passed in 15.719 seconds and exceeded 30 seconds after an 18-second cold startup. That case is isolated only on `darwin`/`arm64`, inside the existing native build job. Its other platforms remain blocking. Performance budgets are not quarantined; collection readiness runs in its own untraced benchmark with the existing one-second budget.

Merge groups on 2026-10-24 added three more native cases. The DMG cleanup fixture stalls in `diskutil unmount force` on Intel macOS runners only. Its separate step in the native build job now runs through the shared Bun runner, so the register decides the stable and quarantine selections there too. Two Apple Silicon navigation relaunch cases also exhausted 30 seconds, like the project-tab case. One more Windows packaged browser case shares the browser validation path that is already quarantined. A Windows packaged startup-recovery case exhausted its 60 seconds, so the packaged desktop quarantine step now runs on every tested native machine. Machines without registered cases select nothing there. A Linux terminal activity case also failed once. The quarantined API step therefore runs on Linux as well as Windows. The three Windows database publication cases share a PowerShell reader fixture. In one merge group none of its readers confirmed an open handle within 15 seconds, so all three are quarantined together. A Windows Codex harness case that writes a 32 MB transcript also exhausted 15 seconds. That extension's tests now run through the shared Bun runner, and the Windows quarantine job runs its registered cases. A Linux packaged Planner case finished its checks but its runtime did not exit after SIGTERM, which may be a real shutdown hang. The packaged CLI job therefore gained a quarantine step on Linux. A Windows desktop attached-recovery case stayed in `starting` past its recovery poll. A Windows Planner dependency-stack case exhausted 15 seconds while the case before it took 13.9 seconds instead of 2.3, so Planner tests now run through the shared Bun runner and the Windows quarantine job runs its registered case. The dashboard UI suite had no quarantine lane. Its Playwright config now reads the register under the `playwright-ui` runner, and its first shard runs the registered cases once per run.

## Limitations

Quarantine temporarily removes these specific cases from merge protection on the affected platforms. It does not prove the product works there. Other platforms and the packaged released-data upgrade contract remain blocking. Every quarantined case still executes without retries or prewarming, at its existing limit, and retains first-attempt evidence. A quarantine failure must be reported separately from stable CI success.

Full reliability runs use ten independent refs at the same commit under `test/ci-reliability/`. The normal full workflow handles them. Ref-specific concurrency prevents cancellation between those runs. Nx disables caching for test, conformance and coverage targets; dependency builds retain caching. The global cache-bypass flag is avoided because it also rebuilds test dependencies. Changes during qualification require ten new runs on the final commit.

## Removal

For each case, reproduce and fix its cause, then meet its registered removal criterion and restore it to the stable lane. Do not remove a supported contract to clear quarantine. Delete this mechanism when the register is empty. Remove the reliability refs after the recorded qualification is no longer needed.
