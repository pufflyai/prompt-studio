# ADR: Explicit ownership for extension execution

Proposed: 2026-10-27

## Status

Proposed for architecture review. This does not approve default rollout or declare the responsive extension execution PRD complete.

The requester prefers staged delivery and explicit architecture decisions over extending a partial implementation with compatibility patches. PR #1475 remains a draft. Further runtime expansion should follow the ownership and protocol decisions below.

## Context

The [responsive execution PRD](../requirements/platform/0015-responsive-extension-execution-and-builds.md) requires process isolation, consistent project snapshots, session continuity, bounded resources and recovery. The recreated measurements support moving computation and preparation away from the API loop. They do not establish that the current in-process extension interfaces can be transported unchanged.

The [rollout inventory](../references/architecture/0032-extension-owner-rollout.md) records the current implementation. The main gaps are architectural:

| Issue | Current evidence and consequence | Required boundary |
| --- | --- | --- |
| Owner lifetime | The registry retains versions until shutdown and stops at 16 owners. Repeated Reload reaches a capacity error. Removing the cap would allow uncontrolled retention. | Explicit references from candidates, adopted snapshots, accepted invocations and durable sessions. Retire only when their authorized references are gone. |
| Remote API contract | Generic callable transport needs special handling for synchronous factories, iterators, streams and session results. Harnesses remain gated; terminals and Blob values are unsupported. Transporting a function does not establish its lifetime or preserve synchronous behavior. | Typed operations, serializable contribution metadata and explicit remote handles with defined ownership, cancellation and release. |
| Reload publication | Failed-candidate retention and a source-key recheck are covered. Publication involving later invalidation, source-row changes, enablement and storage-index installation is not fully proven. | Candidate preparation followed by one guarded publication through the existing catalog. Preparation must not become adoption. |
| Resource accounting | Active callbacks and compilers reserve estimated resources. Kernel observations detect background activity, but resident owners, host-launched children and continuing streams are not fully charged. | Separate process residence from active work; attribute children and background activity to an owner, then use those facts in admission. |
| Authentication | Filtered environments remove implicit access to backend provider keys. Native account work exists in #1482 and #1484, but that does not define delegation of backend-configured credentials to an isolated harness. | Reuse the private native authentication flow and specify any additional approved credential capability explicitly. |
| Failure domain | A synchronous loop requires terminating the shared source process. This can interrupt several projects and sessions. | Host-owned control and an impact report derived from live references. No promise of independent cancellation inside a stuck shared process. |

## Proposed decision

Keep the API as the authority for authentication, authorization, storage and project catalog publication. Keep process separation as the execution boundary, subject to the separate OS sandbox work in [ADR 0058](0058-isolate-extension-backends.md).

Use the existing catalog and runtime services. Do not create a second catalog, a database in each owner or a general durable command broker.

### Source versions and references

Distinguish three identities:

- A source version uses the existing canonical installed path, content/load key and API provider.
- A project generation is an existing published catalog snapshot.
- A process incarnation is one running process for a source version. Restart changes the incarnation without adopting edited source.

The runtime registry owns source-version records. Candidates, published snapshots, accepted invocations and durable sessions acquire explicit references to those records. Acquire an invocation's snapshot reference before its first asynchronous step. Release references on their defined completion, cancellation, replacement or revocation paths.

A new snapshot acquires its references before the old snapshot releases them. An old version can retire only after no authorized reference remains. Garbage collection and a fixed process count are not the lifetime policy. Admission must cover overlap while a candidate and retained versions coexist; insufficient capacity should produce a scoped wait or refusal.

Disable and uninstall must immediately remove future access and apply a documented policy to already accepted work. Existing detached-process behavior must be inventoried before changing it: invocation work and intentionally durable work cannot share an accidental cleanup rule.

### Explicit protocol

Inventory the public SDK surfaces and derive transport adapters from those contracts. Keep pure synchronous helpers in owner-side SDK code. Use explicit operations for host I/O, with host-created invocation scope and opaque handles for streams, subscriptions, processes and sessions.

Every exported handle needs an owner and a release rule. Closing an invocation must revoke its host capabilities; a durable session needs a separate reference. A returned object must not extend authority indefinitely because it contains a function or promise.

Synchronous harness event methods require a compatibility proof. A bounded event channel and a local message projection may fit, but their ordering and acknowledgment rules must preserve the existing public contract. If they cannot, introduce an additive API through the normal deprecation rules. Do not silently turn a synchronous method into a promise or accumulate proxy exceptions for each provider.

Prove the protocol with one complete harness lifecycle before migrating all providers: start, events, question/reply, cancellation, native authentication, asset rebuild, backend replacement, disablement and shutdown.

### Candidate preparation and publication

Prepare an immutable candidate outside the API loop using the production source, dependency-resolution and staging semantics. Capture its source identity and the relevant catalog/enablement revision.

Publish through a bounded, serialized host step that verifies those captured identities and coordinates catalog adoption with installed-source state and storage-index installation. Define the commit point and the compatibility of storage definitions used by accepted old-generation calls. An obsolete or failed candidate must not overwrite newer state or advance the adopted generation.

Keep webview artifact revisions separate from backend contribution adoption. Ordinary asset edits must not restart sessions or import new backend contributions. Retain the previous working artifacts until the latest valid result publishes.

### Resource ownership

Use one coordinator with distinct accounting for process residence and active work. Include candidate/retained overlap, session work, background CPU and child processes. Host process capabilities must register attribution explicitly because their children have the API as their OS parent.

Define memory accounting before applying observed RSS: OS headroom already reflects resident allocations, and subtracting the same memory again would double-count it. Maintain a clear rule for existing residence, pending allocation reservations and incremental job estimates. Record unavailable observations explicitly.

Preserve one physical-process CPU group when several invocations share an owner. Releasing CPU during host I/O must not release process residence or stream/session ownership. Feed comparable completed observations into conservative estimates with documented adjustment rules. Calibrate reserves and queues on the required hardware matrix before default rollout.

### Credentials and recovery

Reuse the private account channel in [SDK/host PR #1482](https://github.com/pufflyai/prompt-studio/pull/1482) and the [native provider work in #1484](https://github.com/pufflyai/prompt-studio/pull/1484). These are related work, not an assumption that credential isolation is solved.

Specify which native login stores remain available and how, if needed, a person authorizes use of a backend-configured provider credential. Do not restore unrestricted environment inheritance, expose the runtime API token or add a competing secret store to bypass the decision.

Stop and recovery stay in the host. Report all affected live references when terminating a shared process. Distinguish an extension error, cancellation, transport loss and uncertain completion. Never replay a failed mutation automatically; accepted host writes and external effects cannot be rolled back by killing the process.

## Delivery sequence

| Stage | Deliverable | Exit evidence |
| --- | --- | --- |
| Architecture | Ownership states, protocol inventory, publication commit point and authentication contract. | Review the decisions and resolve the open questions below. |
| Build pipeline | A narrow change for supersession, staging and retention of working output; use the recreated benchmark fixtures. | Obsolete work cannot publish, cancellation reaps compilers, invalid/repair cases pass and native packaged compilers work. |
| Command execution | One complete command path with explicit snapshot/invocation references, scoped host capabilities and host Stop/Restart. | Real API/storage parity, progress during a loop, no replay, repeated Reload and deterministic retirement. |
| Harness compatibility | One real harness through the proposed protocol and existing native authentication flow. | Active session continuity, event/question ordering, approved authentication and explicit failure behavior. |
| Admission and rollout | Resident/active accounting, child attribution, calibrated policy and complete client progress. | Required constrained/native profiles and release budgets pass before defaults change. |

Useful benchmark, compiler lifecycle and process-supervision work can be retained. The broad draft should be split into reviewable stages after the architecture decisions; it should not be merged as a completed implementation of the PRD.

## Open questions

- What is the publication commit point when source registration, catalog pointers and storage indexes change? How do accepted old-generation calls retain compatible storage definitions?
- Can the existing synchronous harness event contract be preserved with explicit ordered transport, or does it need an additive SDK API?
- What is the approval and lifetime of access to backend-configured credentials, alongside native account sign-in?
- Which existing detached-process uses are intentionally durable, and which must end with their invocation or project?
- Is the shared-source process failure domain acceptable for active harness sessions? If so, make that impact part of the supported product contract.

## Consequences

This requires a host runtime ownership model and protocol design, rather than more serialization cases alone. It preserves the existing catalog, authoritative storage, public API versioning and source semantics. Default rollout stays off while those decisions and their acceptance evidence are incomplete.

No timeout or performance budget changes are proposed. Native test failures and unavailable hardware remain verification issues; they are not evidence that a missing ownership boundary can be replaced with a retry, cap increase or platform skip.
