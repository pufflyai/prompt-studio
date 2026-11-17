# Temporary flaky test quarantine

Proposed: 2026-10-23

Status: Accepted. The user authorized retaining confirmed flaky cases in quarantine on 2026-11-17, superseding the 2026-11-14 removal-only cleanup.

## Intended behavior

Supported product contracts should block their owning CI stage through reliable first-attempt tests. Preserve failure evidence so coverage can be restored after its cause is fixed.

## External limitation

Hosted cold-start variance and browser, filesystem, process, and shutdown failures remain case-specific. Retries do not prove reliability, and unapproved limit increases are forbidden.

## Temporary decision

1. Keep confirmed intermittent cases in the [registry](../../scripts/ci/test-quarantine.json), selected by exact title, owning file and affected platform. Each entry names its owner, failure/pass evidence and removal criteria. Keep assertions and workloads unchanged.
2. Run each registered case once in its separate quarantine lane. Report an observed known-case failure as `quarantined-failure`, separately from stable success. Deterministic product defects, missing benchmark ceilings and setup failures stay blocking.
3. Execute registered cases with their existing assertions and workload; record any separately authorized execution allowance change. Keep setup and build failures blocking. Reject skipped cases, missing reports, retries, incomplete execution, and unknown failed or cancelled jobs.
4. Require native execution evidence and report diagnostic failures separately from stable CI success.

## Limitations and isolation

A quarantined failure does not certify that behavior; it preserves executable coverage and diagnostic evidence while stable checks remain reliable. Removing a failed case leaves a coverage gap. The cleanup removed desktop launch and warm-relaunch cases, several workbench benchmarks, and four navigation metric/request cases. Retained navigation measurements keep their full workload, sample count, and existing budgets.

## Removal

Restore each quarantined case to the stable lane after repairing its cause and obtaining first-attempt native evidence with unchanged assertions and workload. Remove the diagnostic mechanism when it is no longer needed. Do not re-add meta tests for the registry, runners, fixtures, reports, or suite selection.
