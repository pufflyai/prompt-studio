# Separate account authority from content

Proposed: 2026-10-16

Status: Proposed

## Context

PS-735 requires current account and environment authority outside synchronized content. A content restore must not restore access. An older manager restore must invalidate credentials and leave accounts disabled until the operator establishes current ownership and lifecycle.

The account manager is shared across accounts. Its private database and role share a PostgreSQL server with the relay, but ordinary relay data access cannot reach manager authority. Google sign-in is the future user-facing authentication layer. Extensions and local execution contexts must never receive manager database access.

## Decision

Keep the private authority owner in `infra/account-manager/`, separate from relay content and local runtime packages. The factory requires its private PostgreSQL connection from the trusted manager process. It does not authenticate public callers, verify raw Google claims or expose a listener. A later authenticated service must enforce those boundaries before calling lifecycle or issuance methods.

Persist account lifecycle, Google issuer/subject ownership, scoped workbench grants, credential digests and immutable request results. Authorization reads current account/grant state and PostgreSQL time. A request's mutation and safe result commit together. Issuance returns plaintext once; retries recover metadata. Explicit replacement and revocation cannot revive older credentials.

Private manager snapshots contain account/workbench data and safe request receipts. They contain no credential rows or credential digests. Receipt results must belong to their account and a workbench membership in that snapshot. Restore rejects invalid relationships before changing authority.

Owned restore imports missing identities and receipts while preserving every known account, workbench and completed request. Existing owner metadata stays current. A known request fingerprint or result cannot be overwritten by an imported receipt. In the same transaction, restore removes every credential and disables all known and imported accounts. Account/workbench identities and request outcomes are durable history, not permission. Retaining them prevents an older snapshot from forgetting a completed issuance or replaying an old provision as fresh activation. Current operator reconciliation invalidates existing grants before setting explicit ownership/lifecycle. Later Google sign-in and a new registration are required to reconnect an environment.

Restore has its own immutable request ID and snapshot fingerprint. Its receipt commits with the restore and stays outside account snapshots. An exact retry cannot revoke fresh registrations established after the first completed restore. Reusing its ID with another snapshot fails. Both account and restore request history survive owned restore. This preserves known completions; it cannot recover unknown history lost before an external backup was taken.

Serialize manager restore against authority mutations with a shared/exclusive PostgreSQL transaction lock. Use separate advisory key namespaces for the global restore boundary and account identities, so an opaque account ID cannot alias that boundary. Read snapshots at repeatable-read isolation.

## Consequences

The storage owner can be proved on disposable PostgreSQL independently of the unmerged SDK/Planner stack. Real role-denial tests prove the fixture's database boundary; hosting must configure and verify that boundary in deployment.

This child does not establish Google login, session authority, authenticated relay transport, active subscription closure, backups or production recovery. Future credential types must participate in manager invalidation. Future recovery tooling must call the owned restore path rather than install authority tables through content restore. Current manager state is preserved when only content is restored.

This is the intended design. It imports PocketCoder's authority responsibilities without its per-account execution infrastructure, quotas or provisioning model.
