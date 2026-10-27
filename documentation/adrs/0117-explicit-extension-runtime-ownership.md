# ADR: Explicit ownership for extension execution

Proposed: 2026-10-27

## Status

Proposed for review. The decisions below form one architecture proposal; they are not an approval to enable isolation or a claim that the PRD is implemented. Implementation is paused until this design is agreed.

This replaces the open-ended architecture outline in [draft PR #1475](https://github.com/pufflyai/prompt-studio/pull/1475). That branch remains experimental evidence and a source of changes to review individually. It is not the implementation merge unit. The [delivery plan](../references/architecture/0033-responsive-extension-delivery.md) defines smaller PRs after this decision.

## Context

The [responsive execution PRD](../requirements/platform/0015-responsive-extension-execution-and-builds.md) requires responsive host requests, safe Reload, supported extension APIs, bounded resources and recovery. Process measurements support moving computation away from the API loop. They do not establish that an in-process object graph can become a remote API unchanged.

The experimental implementation exposed five missing contracts: retained owner lifetime; synchronous and long-lived APIs; publication across storage and catalog state; resident and child resource accounting; and harness authentication. Increasing the 16-owner pilot cap or adding more generic proxy exceptions would preserve those gaps.

## Decision

Keep one authoritative API/storage owner and the existing project catalog. Use one supervised Bun process per canonical installed source version, shared across the project snapshots that select that source, as in [ADR 0058](0058-isolate-extension-backends.md). Source sharing also shares a process failure domain. It does not provide independent hard cancellation or memory isolation between sessions or projects in that process.

Use typed operations and explicit references. Keep extension code, including its validation and normalization callbacks, out of the API process. Do not create another installed-source database, catalog, secret store or durable command broker. OS filesystem sandboxing remains separate work under ADR 0058.

### 1. Identities and authority

| Identity | Meaning and owner |
| --- | --- |
| Source version | Existing canonical installed path, content/load key and API provider. Different installed copies remain distinct even when names and semver match. The source service owns preparation. |
| Project generation | Existing immutable published catalog snapshot. It includes the adopted source records, contribution descriptors and diagnostics. Only publication advances it. |
| Process incarnation | One process running a prepared source version. Restart changes the incarnation, not the adopted version. |
| Invocation or session | Existing host operation identity and its cancellation scope. The host binds project, instance, workspace, generation and permissions before dispatch. |

An installed-source row describes what is installed on disk. A project snapshot describes what that project adopted. Project contribution metadata and handlers must both come from that snapshot; they must not combine a fresh installed row with old handlers. The install screen may separately show a newer installed version awaiting adoption.

Preparation captures executable bytes and the package/dependency resolution inputs needed to run that version. Published code cannot resolve a later mutable source revision during restart. Reuse the current package resolver and declared dependencies; do not substitute host packages. Retain required package files and dependency installations with the source artifact. Dynamic imports, `import.meta.url`, native modules and package-file reads need parity evidence; a copied entry bundle alone does not prove version retention. Preparation verifies the captured graph again before it can publish.

The host creates a capability scope before any asynchronous dispatch. An owner sends an opaque scope ID, an allowed operation and arguments; it cannot supply a different authority tuple. The host checks scope, incarnation, operation and current revocation on every request. Message IDs correlate replies; they do not grant access. A callback into a different extension gets that target's own scope, with the originating authority and cancellation bound by the host.

### 2. Explicit lifetime

The existing runtime registry owns source records and their references. Every reference has a host owner and an idempotent release path. Concurrent readers of the same source version join its preparation/startup; canceling one candidate releases only its reference, not work another live reference still needs.

| Reference | Acquired | Released |
| --- | --- | --- |
| Candidate | Before preparation or process startup. | Failed, superseded or canceled preparation; or transfer into publication. |
| Snapshot | Before a catalog pointer can expose the source. | Replacement, project removal, disable or uninstall, after replacing that pointer. |
| Invocation | With the chosen snapshot, before the first await that could race replacement. | Terminal result and cleanup; transferred result references must already be installed. |
| Stream/subscription | Before returning a live result or installing delivery. | End, explicit close, cancellation, disconnect or scope revocation. |
| Provider/session | Before provider startup or durable work can outlive its caller. | Provider disposal, confirmed session resource release, removal or shutdown. |

A returned stream extends the invocation's existing authority; it does not acquire permission to change project or survive disablement. A separately created session receives a separate host-owned lifetime before the creating invocation releases its reference. Never infer a durable lifetime from nested functions or unresolved promises.

Replace references by acquiring the new ones before releasing the old ones. When the final reference disappears, stop the process, reap owned children, close the channel and remove its temporary artifacts. Release memory reservations only after exit. A snapshot reference retains restartable source artifacts; it need not keep an otherwise unused process resident. Module-local caches can be lost when an idle process unloads. A provider/session reference protects resources that are still in use. Garbage collection, an idle timer and a fixed process count are not correctness mechanisms.

Existing [session retention](../references/architecture/0020-sessions.md#idle-resources) still decides when idle native session resources can be released. Do not add a second retention period. An open tab, active run, pending question or uncertain native delivery can retain the provider even after a command returns.

Disable/uninstall synchronously revoke future admission for that project/instance and supersede its candidates. Revoke its live capabilities and start scoped cleanup before acknowledging the lifecycle operation. Accepted host mutations may already have committed; revocation cannot undo them. Another project's references remain valid. Report incomplete cleanup rather than releasing its accounting or resurrecting the removed contributions.

### 3. Protocol and supported values

Transport contribution metadata as validated data and executable callbacks as typed contribution IDs bound to one source/incarnation. The owner keeps the actual functions and schemas. No arbitrary property lookup or exported function graph is an authority boundary.

The initial internal channel supports the operation families below. Its version is a packaged host/owner protocol version, distinct from the public extension API version. A mismatch fails explicitly. Unknown operations and unsupported contribution surfaces fail before adoption; they never trigger an inline fallback.

| Public surface | Transport rule and lifetime |
| --- | --- |
| Contribution descriptors, labels, schedules, placements and storage index definitions | Serializable data. Owner evaluates author code; host performs bounded structural validation. |
| Command validation, handlers, middleware, hooks, renderers, settings callbacks and provider methods | Explicit contribution operation and invocation scope. Owner-side validation, result/error and cancellation parity are required. |
| Storage, settings, records, resources, files, workspaces, views, notifications, automation, account and connection requests | Typed host operations authorized by the captured scope. Keep the host's existing validation, storage and commit rules. |
| `storage.scope`, `collection`, artifact mounts and blob URLs | Synchronous owner-side descriptors/factories, not remote I/O. Later operations carry the scope and descriptor. |
| IDs, positions and migration ID helpers | Pure owner-side SDK helpers with the current algorithm. |
| `storage.migrate` | Host serializes the existing scope checkpoint; invokes one registered owner callback with a child capability scope. Failure can leave writes, as in [ADR 0077](0077-extension-owned-data-migrations.md). Do not add replay or a distributed transaction. |
| `connections.stream`, command streams, async iterators and native `ReadableStream` results | Explicit pull/credit, end, error and cancel messages. Preserve byte-reader behavior where the public contract permits it. Close releases both directions and revokes late results. |
| Navigation and logging | Bounded ordered notifications. Flush navigation before returning its command result; do not claim a log was persisted from a local enqueue. Overflow is explicit, not unbounded buffering. |
| `process.run` and `runOrThrow` | Host child handle attached to the invocation; attribute it to source and project before returning from spawn. Abort/return waits for required cleanup. |
| `process.spawnDetached` | Explicitly independent work; see the exception below. It does not retain an invocation or claim managed shutdown. |
| Terminals | Reuse the host PTY supervisor and session IDs. Add an asynchronous open/acknowledgment API before owner migration; preserve the old synchronous API during deprecation. |
| Harness sessions, questions, approvals and authentication | Explicit session/channel handles. Transfer lifetime before start returns; `done` settles once after ordered delivery. Sensitive authentication traffic uses the private channel only. |

Plain data, byte arrays, declared error fields and the explicitly supported stream types have codecs. Preserve `undefined` where public contracts use it. Callback functions, Blob values, custom prototypes, cycles or arbitrary `unknown` results do not acquire support because a generic serializer accepts them. Inventory their actual public use, add a typed codec or additive SDK contract, and prove parity before migrating that surface. Keep deprecated storage and other supported APIs until the scheduled breaking release.

Bound pending calls, handle count, frame bytes, queued bytes and nesting in both directions. Validate before allocating exported handles. Account for actual retained bytes as well as counts; release on failed encode, late reply and transport close. Derive production bounds from the measurements in the delivery plan, rather than promoting pilot constants into the contract.

### 4. Synchronous harness events

Choose an additive asynchronous event contract. Do not implement synchronous host reads with a stale owner-side conversation replica, blocking RPC or an unbounded event queue.

The new contract provides `push(patch): Promise<void>` and `getMessages(): Promise<readonly SessionMessage[]>`. These are design signatures, not exports added by this ADR. New provider/input types sit beside the existing types and use an explicit contribution discriminator so the host cannot mistake one contract for the other. They cover start, resume, reattach and `PreparedHarnessOperation.invoke`, which also receives an event sink today. Deprecate old types only when their replacements are published, following [API versioning](../references/extensions/0014-api-versioning.md).

The host owns a per-session ordered delivery sequence. `push` resolves after validation and application to the authoritative conversation; durable persistence continues to follow the existing host rules. A read is a barrier after earlier pushes on that channel and returns the host's state at that position. The same ordering places host-originated changes, questions, replies, steering acknowledgments and final `done`. `done` cannot overtake an unacknowledged patch. Reject invalid/oversized patches before application. Backpressure waits are cancelable.

Transport loss before acknowledgment means delivery may be uncertain. Do not retransmit patches or native mutations automatically. Reconcile through the provider's existing native-history contract. A private authentication channel has its own cancellation/lifetime and never enters conversation events.

The existing synchronous event API remains supported on the current runtime during migration. A legacy provider is explicitly ineligible for isolated execution; do not import it inline after an owner attempt fails. Per-source eligibility must be checked before choosing the experimental path. Default isolation waits until supported providers are migrated and released. One real Codex lifecycle proves the new contract before other providers adopt it.

### 5. Reload and the publication commit point

Prepare outside the publication gate. Hashing, dependency resolution, bundling, extension evaluation and author validation must not run while holding it. Capture the immutable artifact, candidate operation, source version, installed-row selection and affected project's existing invalidation revision.

Publication uses the existing catalog and storage service, with a short host-owned gate for the affected source/project. Install/update, enablement, uninstall and adoption participate in that same ordering. Acquire multiple affected gates in a stable order. Draining and provider cleanup happen behind an admission fence, outside that gate and outside a database transaction, so disable/uninstall and cancellation can still revoke access immediately. They invalidate the pending adoption. Never wait for owner callbacks while holding a database transaction.

1. Validate the candidate without changing adopted state. A failure retains the last healthy runtime and artifacts, with matching diagnostics.
2. Compare the captured source/operation and project selection. Supersession or removal discards the candidate. Acquire the new snapshot/source references before exposing it.
3. For unchanged storage-index definitions, accepted ordinary commands keep their original generation and may finish. For changed definitions, stop new admission for the existing storage owner (project and extension full ID), and drain all old work that can use those definitions, including live results and accepted host operations. Cover every instance/version sharing that storage owner. Do not run old handlers against replaced index definitions or create a second set of per-generation indexes.
4. A changed harness provider also needs a scoped retirement barrier. Prepare first; active runs and uncertain delivery block replacement until they settle or a person explicitly cancels them. Once idle, call the existing `dispose(ctx)` and await cleanup before replacement workers can start. A paused Reload must explain what it is waiting for and support cancellation. Asset-only publication does not enter this barrier.
5. Under the gate, compare selection/revision again. Install the accepted index definitions and any lifecycle row changes through one existing-storage transaction. The final validation precedes commit. The successful database commit is the publication commit point.
6. Keep affected readers/dispatchers behind the gate across commit. Immediately after success, install the already prepared immutable catalog pointer before releasing the gate; there is no owner callback or other asynchronous work between commit completion and the pointer change. Then release old snapshot references and publish notifications.

Invalidations received before the final validation reject the candidate. Once commit begins, later invalidations are ordered after that commit and make the new snapshot dirty before waiting readers are released. They cannot be silently folded into the accepted candidate. This ordering replaces the current race where committed indexes and the previous snapshot can disagree. Independent projects remain serviceable; database contention still needs measurement against the one authoritative storage service.

If commit fails, keep the previous pointer and definitions. If commit outcome is uncertain, retain the gate, reconcile against authoritative storage and report uncertainty; do not serve old handlers with possibly new definitions. A host crash loses in-memory pointers and references; startup reconstructs a validated runtime from installed state before dispatch. This proposal adds no durable catalog generation or automatic replay of the interrupted Reload.

Publication is atomic for one project snapshot, not for every project sharing an installed copy. Each affected project adopts through its own barrier. Shared installed metadata must not imply that every project already adopted it. Reload results identify the requesting project's actual adoption; diagnostics identify any other waiting or failed project adoption. No success response may claim that preparation alone published a generation.

If draining or provider cleanup fails, leave adoption pending/failed and preserve diagnostics. Cleanup can have stopped native work; retaining old contribution metadata is not a promise to restore volatile execution. A canceled drain reopens old admission only if enablement and authorization still permit it. Incompatible extension data migrations remain the extension's responsibility and are not made reversible by this index barrier.

### 6. Process cancellation and recovery

Cancellation first revokes the invocation's host capabilities and rejects further host work. It settles that caller with cancellation or an uncertain-effect outcome and requests cooperative cleanup. Account for a process or child until it actually exits, even if its caller has settled.

A shared process cannot guarantee hard cancellation of just one invocation. If it remains stuck, expose host-owned Stop for the whole source owner, with affected projects, calls, streams and sessions derived from live references. Scope cancellation does not silently terminate other active sessions. This preserves [ADR 0064](0064-codex-app-server-runtime.md)'s rule against killing a shared native server to cancel one scope. A caller's cancellation can complete while process cleanup still needs whole-owner Stop; clients must show that distinction. If that trade-off is unacceptable, change process granularity in a separate architecture decision before rollout.

Whole-owner Stop cancels candidates, fences new dispatch for that installed source, revokes its scopes and terminates its process trees from the host. Its effect survives later source edits and catalog invalidations for the lifetime of this runtime. Polling and scheduled work cannot restart it. Stop acknowledgment distinguishes requested termination from confirmed reaping and reports uncertainty for accepted host writes or external effects. Forced cleanup can affect every project sharing that source.

Explicit Restart clears that fence only after prior cleanup completes, starts from each referenced adopted artifact subject to admission, and never adopts edited files or replays failed operations. A replacement incarnation must reproduce the adopted descriptor contract before new dispatch; nondeterministic exports that change it require an explicit Reload, not silent metadata replacement. Handles from the old incarnation stay revoked. A later Stop wins over in-flight Restart. Unexpected owner exit permits a new explicit invocation/retry to request one replacement; background polling does not create a restart loop. Initialization/preparation deadlines belong to the supervisor and require measured values before rollout. Sustained CPU alone does not authorize killing an accepted mutation.

`spawnDetached` is a separate public contract: it starts independent work that survives runtime/desktop shutdown. Preserve that behavior. The host checks authority at launch and records bounded launch diagnostics, but does not retain a managed invocation reference or promise to kill that child on Stop, disable or shutdown. Never pass runtime tokens, host capability handles or temporary runtime-owned paths as a durability mechanism. The maintained detached-work fixture is a real supported caller even though no core extension currently uses this method. A future revocable durable-job API would be additive work; this ADR does not redefine detachment as managed execution. The PRD's cleanup claims exclude this deliberate exception.

### 7. Authentication boundary

Use the private `HarnessProvider.getAuthentication` / `authenticate` channel merged in [#1482](https://github.com/pufflyai/prompt-studio/pull/1482). Native CLI/account adoption in [#1484](https://github.com/pufflyai/prompt-studio/pull/1484) is a release dependency, not presumed complete. Native providers own credential validation/storage; sensitive input stays outside command events, logs, scheduler traces and chat history. Flow disconnect, provider retirement and logout revoke the relevant channel and refresh native resources under their existing lifecycle rules.

The first isolated harness supports native sign-in and native credential stores. Keep stable native account homes separate from the temporary owner cwd and from `$PSTDIO_HOME`; do not copy credentials into temporary source artifacts. No provider keys or runtime tokens are inherited from the API environment. A native account already configured by the person may remain usable under the native provider's contract. Process separation still does not sandbox filesystem access or isolate one native account from other extensions; state this limitation until OS sandboxes exist.

Backend-configured environment-key delegation is deliberately excluded from this delivery. A private input channel is not a permission grant, and a generic authenticated runtime request does not prove a person approved secret access. Do not invent a secret getter, pass-through environment option or approval prompt that an agent can self-approve. If native sign-in cannot replace a documented deployment's authentication, default migration for that deployment is blocked. A later ADR must define declared use, human approval authority, scope, expiry, revocation and child-only delivery before such a capability is implemented. This narrows scope; it does not claim credential compatibility is already solved.

### 8. Resource ownership and admission

One in-memory coordinator accounts for preparation, compilation and source execution. Keep two kinds of accounting: resident process/handle ownership, and active CPU work. A session or stream can retain memory without reserving a whole CPU forever. CPU charged to a shared owner is charged once per physical process group; memory retained by several references is also charged once. Register host-spawned managed children explicitly, because their OS parent is the API rather than the owner. Direct owner descendants remain part of its observed process tree. Detached work is reported separately and is outside managed cleanup/admission after launch.

Use effective affinity/quota capacity and current memory headroom. OS headroom already includes resident allocations. Subtract the host reserve, pending unobserved allocations and incremental job estimates; do not subtract measured resident RSS again. Record resident/retained totals for attribution and a runtime growth guard, not as another deduction of the same bytes. Release pending allocation estimates as observations account for them. Record missing/stale metrics explicitly and retain conservative outstanding reservations until the policy can safely reconcile them.

CPU admission reserves host capacity and counts observed background work, managed children and active owner groups. Yield an invocation's logical CPU demand while awaiting host I/O or a nested extension, but keep residence and scope references. Another active invocation or background work keeps the shared group charged. Admit the dependency through the same fair queue, and charge the caller again when it resumes. One-slot nested calls must not deadlock. Accepted resumptions/background CPU can exceed estimates; this is cooperative admission, not an OS CPU quota. On pressure, stop new admission and expose the affected wait; do not kill accepted writes to meet an estimate.

Only owners with no live execution/session/result references may be unloaded to reclaim process residence; their snapshot retains restartable artifacts. Active retained generations count toward overlap. If a candidate cannot fit while old work is live, wait or report a resource refusal rather than raise a process cap or discard working state.

Before enabling this policy, a separate measured policy table must fix reserves, cost estimates, observation cadence/staleness, per-source/project/global queue counts and retained bytes, waiting deadlines, and conservative adaptation rules. Use comparable completed jobs to update estimates, retain a cold-start floor, and change policy only with recorded evidence. Pilot values are not accepted defaults. Existing performance budgets and execution allowances remain unchanged.

## Alternatives and consequences

| Alternative | Reason for this decision |
| --- | --- |
| One process per project or invocation | Reduces some shared failure effects but increases residence/startup and changes module/provider sharing. Keep source-version ownership for this proposal and make whole-owner Stop explicit. Revisit granularity if session failure isolation is required. |
| Generic function/object RPC | Hides authority, lifetime and synchronous semantics. Typed operations and declared handles make those contracts reviewable. |
| Synchronous harness projection or blocking reads | Cannot preserve authoritative reads and bounded backpressure under concurrent host writes. Use an additive async API and explicit migration. |
| Per-generation storage indexes/catalog database | Adds parallel state and synchronization. Drain incompatible old uses and publish through the existing storage/catalog owner. |
| Silent hard cancellation of shared work | Violates session ownership and can lose unrelated work. Require explicit whole-owner control when scoped cleanup cannot complete. |
| Broad environment inheritance or a second secret store | Defeats ADR 0058 and overlaps native authentication. Use native sign-in first; block unsupported credential migration. |
| Merge the experimental draft with defaults off | Gating does not make its ownership contracts complete. Extract small changes with their own evidence after design review. |

The cost is explicit migration of synchronous APIs, possible Reload waits, shared-process failure impact and a later resource calibration gate. Normal Reload keeps accepted compatible commands pinned, and asset edits keep native sessions running. The benefit is one authority for state, deterministic release and a failure model that clients can describe truthfully.

## Acceptance of the design

Maintainer review must accept the async harness migration, drain-before-incompatible-publication rule, shared-source Stop impact and native-auth-first scope. Until then the ADR remains proposed and runtime implementation stays paused. Acceptance of this ADR authorizes the documented boundaries, not default rollout or performance claims.

Protocol parity, measured policy values, native packaging and installed-user walkthroughs are implementation evidence gates in the [delivery plan](../references/architecture/0033-responsive-extension-delivery.md). An observation that contradicts a boundary requires updating this ADR before extending runtime code. A measurement failure requires fixing or narrowing the implementation; it is not permission to raise a timeout or performance budget.
