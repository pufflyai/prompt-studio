# Authenticate relay operation recovery

Proposed: 2026-10-17

Status: Superseded by [PRD 0014](../requirements/platform/0014-local-first-sync.md) on 2026-10-19.

## Problem

After content restore, a native journal must replay missing operations and their captured ancestors with their original identities before submitting later work. Some operations belong to another environment. Normal authenticated submit correctly refuses an environment pretending to author those operations. Unsigned receipt hashes are not evidence that the relay previously stored a body.

## Decision

Every network receipt carries opaque recovery evidence for the exact stored mutation, including pending and conflicting ancestors. Submit responses, snapshots and replay batches all provide it. The relay uses HMAC-SHA-256 over a versioned canonical object containing the full account/workbench/extension scope, original environment, operation ID and canonical mutation fingerprint. The fingerprint covers the complete mutation body. Evidence is transport metadata and never enters the mutation's identity or content digest.

The relay receives a dedicated 256-bit secret from an operator-owned key file. All replicas share that immutable key. It lives outside content snapshots and must survive content restores. Operator fixture initialization creates one key atomically without replacing an existing file; serving runtimes never generate or repair keys. Missing or malformed keys fail startup. Losing or changing the key makes older recovery evidence unusable and leaves recovery incomplete; there is no identity rewrite or unsigned fallback. Back up this key separately with private operator secrets. This implementation does not provide key rotation or a multi-key verifier.

Native journals retain evidence independently of the current accepted snapshot, in one nullable journal column. This is required data: replacing the accepted snapshot after rollback must not discard evidence needed to replay its missing operations.

An authenticated `recover` request requires current account/workbench authorization, the exact scope and valid evidence. It then runs the ordinary mutation validation, immutable-ID checks, dependency checks, asset checks and compare-and-swap publication. Evidence proves prior authenticated storage, not acceptance or permission today. Normal `submit` still requires the currently authenticated environment. Extensions see the same storage API and do not handle recovery or relay credentials.

## Consequences

Recovery preserves the original operation and author environment without opening a way to forge new writes in another environment's name. Proof is issued only after a normally authorized operation has been durably stored. There are no manager calls for each relay operation. Current authorization and finite access expiry remain unchanged.

Recovery requires the journal's retained evidence and the original relay key. An older journal can obtain evidence from current relay snapshots before rollback, but cannot manufacture it after the server has lost the operation. Such incomplete recovery fails explicitly. The local fixture key volume is private to relay/operator processes, and no secret enters extension APIs, content snapshots or public signing trust.
