# Temporary flaky test quarantine

Proposed: 2026-10-23

Status: Accepted.

## Intended behavior

Supported contracts should block their owning CI stage through reliable first-attempt tests. Intermittent failures must remain visible while their causes are repaired.

## External limitation

Hosted cold-start variance and browser, filesystem, process, and shutdown failures have exceeded existing limits or failed intermittently. Their causes remain case-specific; retries do not prove reliability, and unapproved limit increases are forbidden.

## Temporary decision

1. Use the shared [quarantine register](../../scripts/ci/test-quarantine.json) as the authority for exact cases, runner/platform scope, owner, evidence, and removal criteria. Keep incident details there instead of growing this ADR.
2. Only registered executions may fail without failing the stable gate. Other platforms and unregistered cases remain blocking.
3. Execute every selected quarantined case once with its existing assertions, workload, and allowance. Keep setup/build failures blocking. Reject skipped cases, missing reports, retries, incomplete execution, and unknown failed or cancelled jobs.
4. Require a separate execution report and retain first-attempt evidence. Report quarantine failures separately from stable CI success.
5. Preserve one complete ordered desktop benchmark invocation: launch cases precede renderer cases. Classify the same report into stable and registered quarantine results; retain every measurement. Never repeat or move a cold scenario after renderer work.
6. Resolve and pin installed-harness versions before running. When minimum and latest resolve to the same version, the scheduled minimum lane owns one execution; a latest-only invocation still runs it.

## Limitations and isolation

- Quarantine removes only registered case/platform combinations from merge protection. It does not prove those behaviors work.
- The 2026-10-30 single-execution direction replaced earlier requests for repeated full validations. Registered Windows x64 warm-attach and cold-start measurements retain their budgets and required reports; other platforms stay blocking.
- Do not expand scope automatically, prewarm workloads, reduce assertions, or raise limits. Bun, compiled CLI, UI, and packaged runners share the register.

- The 2026-10-31 approval capped execution allowances at 60 seconds. Apple Silicon warm-attach setup uses 45 seconds; the two quarantined Windows desktop lifecycle cases use 60 seconds.
- Intel warm attach retains its 3,000 ms operation budget and 60-second allowance in the ordered desktop lane. Windows Canvas retains its real cold install and preview checks with a 60-second allowance.
- That approval explicitly permits quarantine of the Linux project-switch performance regression. Twenty switches reached 1,885–1,917 ms against the unchanged 1,850 ms budget; the budget remains unmet.
- Workbench benchmarks classify the same first-attempt report as desktop. Keep the complete suite, samples, and assertions; require a separate quarantine report and reject setup, missing-case, skipped-case, and repeated-execution failures.

## Removal
For each case, reproduce and repair its cause, meet its existing registered removal criterion, and restore it to the stable lane. Do not delete a supported contract to clear quarantine. Delete the mechanism when the register is empty; remove obsolete reliability refs once their recorded qualification is no longer needed.
