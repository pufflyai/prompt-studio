---
ticket_id: "PS-76"
user_prompt: "Create a proposal for tagging PRs that change dangerous application areas, such as SDK and DB packages. Suggest tags and explain the setup. Remove the risk: prefix. Add extensions and block PRs with both extensions and sdk labels."
created: "2026-09-11T05:36:31.135Z"
parent_id: ""
depends_on: []
parallelizable: "no"
blocked_reason: ""
---

# add-risk-labels-to-pull-requests

Automatically label pull requests that touch sensitive platform areas. Each label tells reviewers what needs attention. Labels describe the changed area. A required CI status blocks PRs that have both `extensions` and `sdk`, so changes to extensions and their SDK must be reviewed and merged separately.

## Why

The repository has build, test, and release workflows but no checked-in PR labeler. Changes to shared contracts, stored data, and extension execution can affect many tools. Reviewers should see these areas before opening the diff.

This supports the mission by protecting the shared plumbing that tools rely on. It is repository automation, with no new core product feature. People who never read code benefit from more reliable tools. Agents can manage the same PR labels through GitHub. The proposal adds no constraint on remote work or sharing extensions.

## Goals

- Apply all matching sensitive-area labels from changed file paths.
- Refresh labels when the PR changes, including reverted changes.
- Explain the review concern for each label.
- Block merging when synchronized labels contain both `extensions` and `sdk`.
- Support draft PRs and contributions from forks.
- Keep the setup small: a maintained action, one mapping file, and a short operating guide.

### Non-goals

- Automatic severity scores, semantic code analysis, or claims that an unlabeled PR is safe.
- Merge gates beyond the SDK/extensions combination, mandatory reviewers, CI selection, or application changes.
- Automatically declaring SDK changes breaking or DB changes destructive.

## User scenarios and acceptance

### Scenario: See sensitive areas (Priority: P1)

> **Given** a PR changes files under `packages/sdk/` and `packages/pstdio-db/`, **When** it opens or receives commits, **Then** it receives both `sdk` and `database`.

All mappings in `files/schemas.md` apply independently. A change inside a mapped package still receives its area label when it only changes tests or documentation. This simple initial rule avoids fragile exclusions.

### Scenario: Keep labels current (Priority: P1)

> **Given** a PR has both labels, **When** its SDK changes are reverted, **Then** the next successful labeler run removes `sdk` and retains `database`.

Unmanaged labels, including `breaking-change` and `needs-migration`, remain untouched. PRs outside mapped paths receive no automatic risk label. File additions and deletions are included; validate how the selected action handles renames across mapped boundaries and document that behavior.

### Scenario: Label fork and draft PRs safely (Priority: P1)

> **Given** a draft or fork PR touches the SDK, **When** the labeler runs, **Then** it applies `sdk` using trusted configuration without checking out or executing PR code.

A PR editing the label rules cannot apply its proposed rules before they reach the trusted branch. Workflow failures remain visible in Actions; label absence is never treated as approval.

### Scenario: Record review judgment (Priority: P2)

> **Given** a reviewer finds a compatibility break or a required data transition, **When** they add `breaking-change` or `needs-migration`, **Then** future automatic updates preserve that judgment.

### Scenario: Block combined SDK and extension changes (Priority: P1)

> **Given** a PR touches `extensions/**` and a path mapped to `sdk`, **When** classification finishes, **Then** both labels are present and the required `sdk-extension-separation` status fails.

The failure tells the author to split SDK and extension changes into separate PRs. SDK-only, extensions-only, and neither-area PRs pass this policy. All other labels are irrelevant to this rule. Tests and documentation inside these mapped paths count too. `extension-runtime` alone does not trigger the rule.

### Scenario: Reevaluate the blocking rule (Priority: P1)

> **Given** a blocked PR, **When** one area is removed from its diff, **Then** classification removes the stale label and the status passes for the current head commit.

Manual removal of a matching managed label causes reclassification and cannot clear the block. Classification errors must never produce a passing status. Run the policy immediately after label synchronization in the same workflow; do not depend on a second workflow receiving bot-generated label events. Publish results for the evaluated head SHA, never the base SHA, and do not let an older run overwrite a newer result.

## Implementation outline

1. Create the proposed labels with the descriptions in `files/schemas.md`. Use amber for automatic area labels and red for manual consequence labels.
2. Add `.github/labeler.yml` with the proposed path mappings. Keep this file as the only executable mapping source.
3. Add a dedicated `.github/workflows/pr-risk-labels.yml` using `actions/labeler`, pinned to a reviewed full commit SHA. Use `pull_request_target` for opened, synchronize, reopened, edited, labeled, and unlabeled events. The edited event covers base-branch changes. Run on draft PRs too.
4. Use `contents: read`, `pull-requests: write`, and narrowly scoped `statuses: write` for the required commit status. Pre-create labels so the workflow does not need `issues: write`. Fetch configuration through the action from the trusted repository context. Do not check out code or install dependencies. Enable `sync-labels` and serialize runs per PR so updates cannot race.
5. In the same workflow, publish `sdk-extension-separation` as pending for the evaluated PR head, synchronize labels, and evaluate the resulting managed labels. Report failure for the forbidden pair, success otherwise, and error for classification failures. Use a small trusted TypeScript policy module if custom code is needed. Never evaluate the stale event label snapshot. Require this exact status in the `main` branch rules, tied to the expected publishing integration where supported. A failing workflow alone does not block merging without that rule.
6. Add a short repository guide explaining ownership, review expectations, how to add mappings, and how to rerun labeling. Provide a manual dispatch accepting a PR number for backfills and rule changes.
7. Validate the scenarios with disposable PRs after the workflow reaches the trusted branch. Check overlapping mappings, reversions, unrelated labels, fork permissions, drafts, base changes, deletions, and renames. Run `bun run validate` for the implementation. Use test-first development for any TypeScript policy logic: both labels fail; either or neither passes. Do not add unit tests that only assert configuration values. Prove that GitHub actually blocks a mixed PR and permits a corrected PR, including fork PRs and label removal.

## Product changes

- GitHub PRs display sensitive-area labels automatically.
- Reviewers have a shared explanation of what each label means.
- Maintainers can rerun classification after updating the rules.
- PRs combining SDK and extension changes cannot merge under the required policy.

## Assumptions

- A1: Area labels are informational except for the required SDK/extensions separation rule.
- A2: Maintainers can create repository labels, enable workflow permissions, and configure required status checks.
- A3: All files inside sensitive packages count initially. Review noise can inform a later change.
- A4: The initial seven labels are sufficient; optional labels are documented as future ideas.

## Risks and open questions

- Path matching cannot detect every dangerous change, especially behavior altered through shared dependencies or code moved outside mapped areas.
- SDK tests and documentation still trigger labels. This is deliberate area classification, with possible review noise.
- Repository labels, organization Actions restrictions, and branch rules have not been inspected remotely. Confirm them during implementation and reuse existing equivalent labels where appropriate.
- [MISSING INFORMATION] Which maintainer or team should own updates to the path mappings? This does not block drafting the setup.
- The separation rule makes coordinated breaking SDK changes harder. Split compatible SDK preparation, extension adoption, and later cleanup into independently valid PRs. No bypass label is proposed.
- The existing CI listens for `merge_group`, but remote merge-queue settings are unverified. If a queue is enabled, implementation must evaluate each constituent PR and publish the same required status on the merge-group SHA. Do not reject a group merely because it contains separate valid SDK-only and extension-only PRs. Verify this before enabling the required rule.
- Required owner approval is a separate future decision. This policy enforces change separation, not overall safety.

## Supporting resources

- `files/research.md`: repository findings and primary sources.
- `files/contracts.md`: required CI status inputs, outputs, and lifecycle.
- `files/schemas.md`: proposed labels and configuration mappings; no database schema changes.
- `files/cookbook.md`: rollout and reviewer workflow.
- `files/adr.md`: proposed automation ownership and execution boundary.

No application contracts or package boundaries change. The CI contract is documented separately; a system architecture document is unnecessary.
