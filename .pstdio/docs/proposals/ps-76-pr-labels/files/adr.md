# Proposed decision: area labels and required SDK/extensions separation

Status: proposed. This document belongs to the proposal; no repository-wide ADR or workflow is activated by it.

## Context

Sensitive code spans public contracts, persistence, extension execution, trust boundaries, sync, and release controls. Reviewers need a consistent visible signal. Paths identify affected areas but do not establish severity or correctness.

## Decision

Use GitHub Actions and a maintained labeler with one checked-in path mapping. The workflow owns only configured area labels. Reviewers own separate consequence labels. A required CI status fails when synchronized labels contain both `sdk` and `extensions`. The same workflow owns synchronization and policy evaluation so its result does not depend on a later label event. GitHub remains the only store for PR labels; no application state is added.

Use a narrowly scoped `pull_request_target` workflow for fork support. Pin the action to a reviewed commit. Read trusted configuration and PR metadata without executing contribution code. Pre-create repository labels to avoid granting label-creation permissions to the workflow. Grant status-write permission only to publish the policy result on the evaluated PR head commit. Metadata checks do not require executing PR code.

## Trade-offs

Whole-package rules also label tests and documentation. This is simpler and easier to audit than exclusions. Precise security rules need maintenance when code moves. Manual consequence labels need reviewer judgment. Most labels are advisory. The SDK/extensions pair blocks merges through a required branch status. This adds a repository policy, not proof that other PRs are safe. Coordinated changes need independently valid PRs; no bypass label is introduced.

## Alternatives

- Manual area labels: no automation to maintain, but easy to forget and leave stale.
- A custom TypeScript classifier: more control, but unnecessary maintenance for basic path matching.
- Automatic low/medium/high severity: paths do not provide enough evidence for reliable severity.
- Mandatory owner approval: potentially useful later, but requires named owners and a separate review-policy decision.

This is the intended design, not a temporary workaround for an external limit.
