# Separate account authority from content

Proposed: 2026-10-16

Status: Proposed

## Context

PS-735 requires current account and environment authority outside synchronized content. A content restore must not restore access. An older manager restore must invalidate credentials and leave accounts disabled until the operator establishes current ownership and lifecycle.

The account manager is shared across accounts. Its private database and role share a PostgreSQL server with the relay, but ordinary relay data access cannot reach manager authority. Better Auth owns Google sign-in and human sessions inside the TypeScript manager. Extensions and local execution contexts never receive manager database access.

## Decision

Keep the private authority owner in `infra/account-manager/`, separate from relay content and local runtime packages. Its lifecycle methods remain private operator APIs. An embedded Better Auth service verifies Google identities and human sessions. Session-authenticated management resolves the library's Google provider subject to the account's canonical issuer/subject, without using email. The caller selects an account; this adds no signup or account-cardinality policy.

Use Better Auth's MIT-licensed library with PostgreSQL/Drizzle and its persisted JWT keys. Product environment grants remain renewal authority. Current grant/account checks issue finite signed access, capped at grant expiry. The relay receives public verification trust and validates signature, issuer, audience, product token type, finite expiry and account/workbench/environment claims without a manager call or database. Reject generic human tokens as environment access.

Revocation, replacement, disable and owned manager recovery deny future renewal. Already issued access stays valid until expiry; subscriptions must close or validly renew at that point. No immediate-revocation broadcast, per-operation introspection or idle manager polling is required. Human logout denies further session-based management; environment renewal remains governed by its independent product grant.

Persist account lifecycle, Google issuer/subject ownership, scoped workbench grants, credential digests and immutable request results. Authorization reads current account/grant state and PostgreSQL time. A request's mutation and safe result commit together. Issuance returns plaintext once; retries recover metadata. Explicit replacement and revocation cannot revive older credentials.

Private manager snapshots contain account/workbench data and safe request receipts. They contain no credential rows or credential digests. Receipt results must belong to their account and a workbench membership in that snapshot. Restore rejects invalid relationships before changing authority.

Owned restore imports missing identities and receipts while preserving every known account, workbench and completed request. Existing owner metadata stays current. A known request fingerprint or result cannot be overwritten by an imported receipt. In the same transaction, restore removes every renewal credential, library session and pending verification, and disables all known and imported accounts. Preserve library provider identities and signing keys; an unexpired token retains its original verification/expiry contract. Account/workbench identities and request outcomes are durable history, not permission. Retaining them prevents an older snapshot from forgetting a completed issuance or replaying an old provision as fresh activation. Current operator reconciliation invalidates existing grants before setting explicit ownership/lifecycle. Fresh Google sign-in and registration establish new environment authority.

Restore has its own immutable request ID and snapshot fingerprint. Its receipt commits with the restore and stays outside account snapshots. An exact retry cannot revoke fresh registrations established after the first completed restore. Reusing its ID with another snapshot fails. Both account and restore request history survive owned restore. This preserves known completions; it cannot recover unknown history lost before an external backup was taken.

Serialize manager restore against authority mutations with a shared/exclusive PostgreSQL transaction lock. Use separate advisory key namespaces for the global restore boundary and account identities, so an opaque account ID cannot alias that boundary. Read snapshots at repeatable-read isolation.

## Consequences

The storage owner can be proved on disposable PostgreSQL independently of the unmerged SDK/Planner stack. Real role-denial tests prove the fixture's database boundary; hosting must configure and verify that boundary in deployment.

Source tests exercise Better Auth with an owned Google public-key protocol fixture, real sessions and real PostgreSQL. A bundled HTTPS manager and a verifier-only process prove local issuance without sharing manager credentials. These are not live Google deployment, authenticated relay integration, backup or capacity evidence. Full database/key recovery needs independent backup/operator proof; do not remove a public verification key while it still covers valid access. Recovery tooling must call owned restore rather than install authority tables through content restore. Current manager state is preserved when only content is restored.

This is the intended design. It imports PocketCoder's authority responsibilities without its per-account execution infrastructure, quotas or provisioning model.
