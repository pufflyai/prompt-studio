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

- The 2026-11-01 certification added the exact Linux Side Panel close/reopen case under the same authorization: a 52 ms long task exceeded the unchanged 50 ms limit. It passed prior hosted qualification and failed an unchanged-main control. All seven workbench benchmarks retain their original order, samples, assertions, budgets, and allowances.
- The same certification added Intel macOS automatic recovery after a sidecar crash: 586 ms exceeded its unchanged 500 ms budget after a prior native pass. Preserve its complete crash/recovery workload and ordered desktop evidence; other platforms remain blocking. The register owns both cases' owners and removal criteria.

- The next 0.46 certification quarantined only navigation's `ticket/repeat structure` contract under the same authorization: one sample reached 376.5 ms against the unchanged 375 ms budget. Retain all 120 measurements, thirty per destination and visit, the fixed fixture, budgets, and raw errors. Require one fresh ordered execution and a separate quarantine report; missing or reordered measurements, browser errors, request failures, and every other navigation budget remain blocking. This performance debt remains unresolved.

## Removal

For each case, reproduce and repair its cause, meet its existing registered removal criterion, and restore it to the stable lane. Do not delete a supported contract to clear quarantine. Delete the mechanism when the register is empty; remove obsolete reliability refs once their recorded qualification is no longer needed.
