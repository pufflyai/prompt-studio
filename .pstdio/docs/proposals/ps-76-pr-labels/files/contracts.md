# CI policy contract

- Input: the evaluated PR head SHA and managed labels after successful synchronization against trusted path rules.
- Rule: fail when both `sdk` and `extensions` are present; pass every other combination.
- Output: commit status context `sdk-extension-separation`, published on the evaluated head SHA with a link to the workflow run.
- Lifecycle: publish pending before synchronization, then success or failure. Publish error if classification or evaluation fails; never turn missing data into success.
- Failure guidance: split SDK and extension changes into separate PRs.
- Consumer: the required-status rule for `main`. Bootstrap and validate the status before making it required.
- Refresh: new commits, base changes, reopening, label edits, and manual dispatch all refresh classification and policy together. Automated label changes do not need a second workflow run.
- Concurrency: serialize by PR, reread the current head before evaluation, and never apply an old result to a newer head. Do not report success if the evaluated head changed during processing.
- Queue: if enabled, evaluate constituent PRs independently and publish the same context on the merge-group SHA. A group containing separate valid SDK and extension PRs is allowed.

No SDK, HTTP, or database interface changes are proposed.
