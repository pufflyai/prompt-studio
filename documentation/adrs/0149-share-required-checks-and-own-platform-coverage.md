# Share required checks and own platform coverage

Proposed: 2026-11-14

Status: Accepted direction; implementation and hosted qualification in progress.

## Decision

PRs and merge groups apply the same required profile to their actual candidate and combined changes. Run all fast units, affected source integrity contracts, relevant static/type checks, one Linux desktop package, packaged smoke and affected flows. Target at most ten minutes from workflow creation through the required result, including runner waits and cleanup. Existing test allowances and performance budgets do not change.

Linux owns shared behavior. Other hosts own native OS and actual-artifact contracts. Coverage applicability is separate from priority and is sealed into the existing immutable test plan. Shared CLI/browser journeys keep their current Linux owner until the same assertions pass in Electron. Mixed native tests retain explicit native execution until qualified replacements exist. The 2026-11-14 user-directed cleanup removes known-failing quarantined cases and meta tests; these deletions are coverage gaps, not qualified replacements.

Stable certificates name shared and native desktop contracts accurately and bind selection/execution policy to the actual source and artifacts. No test result transfers to another candidate. P3, signing, install/update and dedicated native verification remain outside the ten-minute PR promise.

## Qualification

Retain old/new file and case inventories with exact replacements. Qualify representative cold and warm first-attempt PR and real merge-group runs, report runner waits and slow phases, and verify the final artifact contracts. Missing evidence and overruns remain unqualified. Restore a family's prior selection when its replacement fails, except cases deliberately removed under the failing-quarantine cleanup. Local planner/unit passes do not prove native runtime coverage or the hosted time target.

This supersedes the PR/queue breadth and timing policy in [ADR 0129](0129-prioritize-merge-checks-and-certify-release-candidates.md). Its immutable candidate, artifact and publication requirements remain in force. See the [CI stages guide](../guides/development/0015-ci-stages.md) for implementation and remaining qualification work.
