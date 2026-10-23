# Temporary flaky test quarantine

Proposed: 2026-10-23

## Decision

Keep supported behavior tests, including upgrades that preserve local data. Separate confirmed intermittent failures from the stable CI gate while continuing to execute them on every applicable full run. The user requested quarantine and ten independent full validations on 2026-10-23.

`scripts/ci/test-quarantine.json` owns the exact case names, affected platforms, responsible area, failure evidence, and removal criteria. Bun package runners and the packaged Playwright configuration use that same register. Stable tests remain required. Only `quarantined_bun_tests` and `quarantined_browser_tests` are nonblocking. Their actual failures remain visible in Actions; the aggregate waits for them. Unknown failed or cancelled jobs still fail the gate.

## External limitation

Hosted runner cold-start variance has exceeded existing execution allowances in database upgrade and Changesets CLI fixtures. Chromium editing previews have also failed intermittently after reload. The exact remaining causes have not been established. Retrying a passing case does not establish reliability. Increasing limits without explicit approval would violate the repository's time-limit rule.

## Limitations

Quarantine temporarily removes these specific cases from merge protection on the affected platforms. It does not prove the product works there. Other platforms and the packaged released-data upgrade contract remain blocking. Every quarantined case still executes without retries or prewarming, at its existing limit, and retains first-attempt evidence. A quarantine failure must be reported separately from stable CI success.

Full reliability runs use ten independent refs at the same commit under `test/ci-reliability/`. The normal full workflow handles them. Ref-specific concurrency prevents cancellation between those runs. Test commands bypass Nx result caches; build and dependency caches remain available. Changes during qualification require ten new runs on the final commit.

## Removal

For each case, reproduce and fix its cause, then meet its registered removal criterion and restore it to the stable lane. Do not remove a supported contract to clear quarantine. Delete this mechanism when the register is empty. Remove the reliability refs after the recorded qualification is no longer needed.
