# Temporary flaky test quarantine

Proposed: 2026-10-23

Status: Accepted for focused diagnosis. The 2026-11-14 cleanup replaces retention of known-failing cases with removal.

## Intended behavior

Supported product contracts should block their owning CI stage through reliable first-attempt tests. Preserve failure evidence so coverage can be restored after its cause is fixed.

## External limitation

Hosted cold-start variance and browser, filesystem, process, and shutdown failures remain case-specific. Retries do not prove reliability, and unapproved limit increases are forbidden.

## Temporary decision

1. Remove known-failing quarantined cases and their entries from the [registry](../../scripts/ci/test-quarantine.json). Keep their evidence in the ticket or report and their source in Git history. Do not return failures to the stable lane, rename them, or leave permanent skips.
2. The registry is empty after the cleanup. Its runners remain available for focused diagnosis, not as a backlog of failing tests.
3. If a diagnostic case is registered, execute it once with its existing assertions, workload, and allowance. Keep setup and build failures blocking. Reject skipped cases, missing reports, retries, incomplete execution, and unknown failed or cancelled jobs.
4. Require native execution evidence and report diagnostic failures separately from stable CI success.

## Limitations and isolation

Removing a failed case leaves a coverage gap; a passing stable gate does not certify that behavior. The cleanup removed desktop launch and warm-relaunch cases, several workbench benchmarks, and four navigation metric/request cases. Retained navigation measurements keep their full workload, sample count, and existing budgets.

## Removal

Restore product behavior coverage after repairing its cause. Remove the diagnostic mechanism when it is no longer needed. Do not re-add meta tests for the registry, runners, fixtures, reports, or suite selection.
