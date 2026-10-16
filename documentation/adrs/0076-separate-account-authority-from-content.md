# Separate account authority from content

Proposed: 2026-10-16

Status: Proposed

## Context

PS-735 requires current account and environment authority outside synchronized content. A content restore must not restore access. An older manager restore must invalidate credentials and leave accounts disabled until the operator establishes current ownership and lifecycle.

The account manager is shared across accounts. Its private database and role share a PostgreSQL server with the relay, but ordinary relay data access cannot reach manager authority. Google sign-in is the future user-facing authentication layer. Extensions and local execution contexts must never receive manager database access.

## Decision

Keep the private authority owner in `infra/account-manager/`, separate from relay content and local runtime packages. The factory requires its private PostgreSQL connection from the trusted manager process. It does not authenticate public callers, verify raw Google claims or expose a listener. A later authenticated service must enforce those boundaries before calling lifecycle or issuance methods.

Keep Google token verification in this private manager package. Use JOSE with fixed Google public key trust and RS256, the configured web client audience/presenter, required subject/time claims and the expected pending-login nonce. Return only canonical verified issuer/subject identity. A trusted fetch transport may handle proxying or real fixtures; token input cannot select a key source. Leave key caching and refresh to the library. The private code coordinator composes this verifier with the challenge/session owner below. This stateless verifier is not a public login endpoint or permission check.

Own Google authorization-code composition in the same private package. Begin through durable state and return a fixed Google URL with minimal openid/code scope, nonce and S256 PKCE. Reuse the random browser binding as the ephemeral verifier without storing plaintext or adding a login phase. A trusted confidential web-client configuration supplies client/secret/registered HTTPS redirect and an explicit exchange deadline. Complete only after a live bound challenge lookup, fixed form-encoded token exchange, existing JOSE verification against its stored nonce and the atomic current-owner check. Follow no token redirects or automatic code retries. Return only the manager session; discard Google tokens/profile fields. Sanitize configuration/completion errors without original sensitive objects or causes. Hold no database transaction across Google requests. The later public handler owns protected binding/session transport, callback parsing/CSRF and account selection; no signup/cardinality policy is inferred here.

Own pending login challenges and finite owner sessions in this same private database. Store state/browser-binding digests and a nonce; challenge existence means pending. A trusted handler verifies Google identity against that nonce, then atomically consumes the challenge and creates a digest-backed session for the current matching active account. The account lock is shared with lifecycle changes. A session references current account authority instead of copying owner/active state. Its expiry is explicit trusted policy. Concurrent completion has one winner; a lost response requires a fresh login.

Logout removes a session idempotently. Disable/reconcile invalidate affected sessions. Owned restore removes every session and pending challenge before visibility, and snapshots exclude both tables. Expired rows are cleaned when login begins. Preserve generated schema history and add a new generated migration; upgrading existing authority must retain its environment grants. The later HTTP service owns browser transport and public permissions; these private state methods do not supply that service.

Provide session-scoped environment registration, replacement, listing and revocation through the same private owner. Derive the account from the session, acquire its account lock and recheck live session/active account/database-time expiry inside the global restore boundary before reading a receipt or mutating grants. Check each call rather than retaining permission in a session object. Inputs cannot name an account or owner. Share transaction-taking grant and receipt operations with privileged operator methods; add no state or new credential type. Stable domain intent defines immutable retries, never the session bearer, so a fresh valid session can recover metadata without reissuing plaintext. Public handlers must use this boundary rather than an earlier authorize-then-mutate check. Already authorized in-flight work may finish; later calls require current authority.

Persist account lifecycle, Google issuer/subject ownership, scoped workbench grants, credential digests and immutable request results. Authorization reads current account/grant state and PostgreSQL time. A request's mutation and safe result commit together. Issuance returns plaintext once; retries recover metadata. Explicit replacement and revocation cannot revive older credentials.

Private manager snapshots contain account/workbench data and safe request receipts. They contain no credential rows or credential digests. Receipt results must belong to their account and a workbench membership in that snapshot. Restore rejects invalid relationships before changing authority.

Owned restore imports missing identities and receipts while preserving every known account, workbench and completed request. Existing owner metadata stays current. A known request fingerprint or result cannot be overwritten by an imported receipt. In the same transaction, restore removes every credential and disables all known and imported accounts. Account/workbench identities and request outcomes are durable history, not permission. Retaining them prevents an older snapshot from forgetting a completed issuance or replaying an old provision as fresh activation. Current operator reconciliation invalidates existing grants before setting explicit ownership/lifecycle. Later Google sign-in and a new registration are required to reconnect an environment.

Restore has its own immutable request ID and snapshot fingerprint. Its receipt commits with the restore and stays outside account snapshots. An exact retry cannot revoke fresh registrations established after the first completed restore. Reusing its ID with another snapshot fails. Both account and restore request history survive owned restore. This preserves known completions; it cannot recover unknown history lost before an external backup was taken.

Serialize manager restore against authority mutations with a shared/exclusive PostgreSQL transaction lock. Use separate advisory key namespaces for the global restore boundary and account identities, so an opaque account ID cannot alias that boundary. Read snapshots at repeatable-read isolation.

## Consequences

The storage owner can be proved on disposable PostgreSQL independently of the unmerged SDK/Planner stack. Real role-denial tests prove the fixture's database boundary; hosting must configure and verify that boundary in deployment.

This component does not establish public browser login, authenticated relay transport, active subscription closure, backups or production recovery. Future credential types must participate in manager invalidation. Future recovery tooling must call the owned restore path rather than install authority tables through content restore. Current manager state is preserved when only content is restored.

This is the intended design. It imports PocketCoder's authority responsibilities without its per-account execution infrastructure, quotas or provisioning model.
