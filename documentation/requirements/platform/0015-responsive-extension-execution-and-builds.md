# PRD Responsive extension execution and builds

Status: Proposed. Created: 2026-10-25.

Prompt Studio must remain usable while an extension computes, reloads, or rebuilds after an edit. The platform must isolate extension execution from the API event loop, schedule expensive work within the host's resources, and recover a failing extension without restarting the backend or losing saved work.

## Problem

Extension command bodies, source evaluation, and parts of Reload currently run on the API thread. Synchronous work in any of these paths can prevent HTTP requests, database-backed reads, live sync, and other extension commands from progressing. Declaring a function `async` does not move its synchronous work to another thread.

Webview compilers already run in Bun subprocesses. Their source scanning, hashing, bundling, module evaluation, and publication preparation can still occupy the API thread. The current compiler limit is `max(1, min(4, availableParallelism()))`: CPU count influences it, but available memory, container quotas, and the cost of a build do not determine the limit.

Returning an overload response cannot interrupt synchronous code already blocking the API. Likewise, adding workers without limiting their aggregate resource use can leave the whole machine saturated. Execution ownership and resource admission must work together.

## Outcomes and product boundary

This is shared extension-platform work under the [mission](../../../MISSION.md). An individual extension cannot isolate another extension, own the API scheduler, or preserve workbench responsiveness when the host event loop is blocked.

The required outcomes are:

- A person can use another tool, navigate loaded pages, and cancel work while an extension is slow.
- An author can save extension edits repeatedly, see diagnostics, and recover from an invalid edit while the last working view remains available.
- Reload prepares a replacement without stalling unrelated requests or reporting a failed candidate as adopted.
- Expensive work adapts to the runtime machine's available resources without manual concurrency tuning.
- The dashboard, CLI, SDK, and agents receive consistent progress, cancellation, and failure outcomes through the same platform interfaces.

This PRD covers backend extension callbacks, source preparation, webview builds, execution scheduling, and the workbench behavior needed to explain local failures and backend disconnection. It preserves the [project snapshot contract](../extensions/0001-runtime-snapshots.md) and [extension API versioning rules](../../references/extensions/0014-api-versioning.md).

It does not define a new database engine, move PGlite into every extension, add a durable general-purpose command broker, redesign offline synchronization, or promise operation under complete operating-system resource exhaustion. OS filesystem sandboxes remain the separate platform work described in [ADR 0058](../../adrs/0058-isolate-extension-backends.md). Process separation alone must not be presented as that sandbox.

## Evidence and current implementation

The [command worker experiment](../../references/architecture/0030-extension-worker-prototype.md), recorded on 2026-10-24, ran unchanged CPU-heavy extension commands through the real API and host storage. Three trials used 1,000,000,000 checksum iterations on Linux with four available CPUs. The command took approximately 1.2 seconds in both modes.

| Unrelated operation during the command | Inline p95 | Worker p95 | Worker maximum | Requests completed during work, inline / worker |
| --- | ---: | ---: | ---: | ---: |
| Health request | 1,150.16 ms | 1.70 ms | 10.50 ms | 0 / 172 |
| Database-backed projects read | 1,161.56 ms | 2.48 ms | 11.46 ms | 0 / 169 |
| Another extension's command | 1,165.64 ms | 5.52 ms | 14.84 ms | 0 / 154 |

Each probe allowed one request in flight and paused 20 ms between responses. Inline execution produced only three samples per operation because each initial request blocked until the slow command finished. Its p95 therefore equals its maximum. These are controlled responsiveness measurements, not requests-per-second capacity figures.

The [build and edit experiment](../../references/architecture/0031-extension-build-and-edit-measurements.md), recorded on 2026-10-25, used the production watcher, loader, hashing, build manager, and real compiler. Three trials used six views sharing 64 generated modules. The following comparison keeps compiler concurrency at four to separate preparation isolation from concurrency tuning.

| Unrelated operation and workload | API-thread preparation p95 | Isolated preparation p95 |
| --- | ---: | ---: |
| Projects read during a shared-file edit | 34.9 ms | 4.7 ms |
| Another extension's command during a shared-file edit | 50.3 ms | 10.0 ms |
| Projects read during rapid edits and compilation | 59.3 ms | 5.1 ms |
| Another extension's command during rapid edits and compilation | 64.8 ms | 8.6 ms |

During costly backend-source preparation, maximum health latency fell from 328.8 ms to 3.8 ms at the same four-job limit. Maximum health latency during the actual Reload API remained approximately 305–331 ms across the isolated configurations because that host path was not moved.

The compiler cost profiles observed 1.62–1.91 CPU cores and 147.8–155.4 MiB peak child RSS. The experimental hardware policy selected one compiler on the four-CPU host. Median shared-edit completion was 236 ms with current preparation and four compilers, 247 ms with isolated preparation and one compiler, and 270 ms with isolated preparation and four compilers. These results do not establish a universal optimal concurrency.

Unchanged saves ran no compilers. Five rapid edits resulted in twelve compilations, including an obsolete six-view batch. Failed edits retained working output, and repairs published the new revision. Every recorded burst included subsequent edits while compilers were active.

The prototypes remain test utilities. Command isolation bridges only three storage methods; imports and the remaining callback and context surfaces are incomplete. Build registration is harness-owned. Worker-thread measurements establish the benefit of moving work off the API loop; production subprocess costs still need measurement.

## Execution ownership

The production direction follows ADR 0058: one Bun subprocess per installed source version, shared by the project snapshots that reference that source. In this PRD, an **extension owner** is that process and the host-side supervisor responsible for it. The existing catalog **generation** identifies a published project snapshot. A candidate is identified by its canonical source version and preparation operation until publication; preparation alone does not advance the catalog generation.

The source identity must use the existing canonical source/version rules, including the content/load key rather than only a manifest version number. An edit can create a candidate without changing package semver. Different installed copies must not be merged merely because they declare the same package name. Project identity, enabled instance, workspace, authorization, and cancellation remain invocation-scoped. Sharing a source owner must not grant one project access to another project's data.

| Component | Responsibility |
| --- | --- |
| API host | HTTP, authentication, permission checks, authoritative database and storage access, project catalog publication, and supervisor control. |
| Extension owner | Extension entry import and evaluation, executable callbacks, module-local state, and contribution descriptions and handler references returned to the host. |
| Preparation owner and compiler children | File watching, graph scanning, hashing, source bundling, build staging, and compiler execution away from the API loop. Trusted orchestration can share an owner where lifecycle and resource accounting remain clear. |
| Runtime resource coordinator | One resource budget for extension dispatch, preparation, and compilation; admission, fairness, queue bounds, and cancellation accounting. |
| Workbench and other clients | Operation progress, diagnostics, cancellation, retained views and drafts, and existing backend connection status. |

The API must never import an extension entry to inspect its exports, obtain metadata, evaluate a schema supplied by the extension, or run a callback. Serializable metadata and callable references cross the boundary; extension functions remain in the owner. Host authorization always remains in the host.

## User journeys

| Journey | Required experience |
| --- | --- |
| Run a slow command | The command shows its own progress. Other tools and core controls remain operable. Cancel remains reachable. |
| Save a webview source edit | The source watcher schedules the affected assets. The last working view remains available until replacement output is ready. |
| Save several edits during compilation | The latest revision becomes the desired result. Obsolete work stops consuming avoidable resources, and an older result cannot replace the latest one. |
| Save invalid source, then repair it | Diagnostics identify the source or view. Working output remains available with its failure or stale indication. Repair clears the failure through successful publication. |
| Reload backend contributions | Preparation happens in a candidate owner. The existing adopted snapshot stays available until a validated replacement is published. |
| Run out of build capacity | The affected operation explains that it is waiting for resources and supports cancellation. Other extensions can continue within the shared budget. |
| An owner hangs or exits | Its affected calls receive an explicit failure or cancellation outcome. The supervisor can create a fresh owner, and unrelated owners keep running. |
| Lose the backend connection | The workbench retains loaded navigation and existing drafts, shows Backend unavailable, and reconnects through its existing connection owner. It does not report interrupted writes as successful. |

An extension waiting for resources or reporting an error must not, by itself, set the global backend-unavailable indication.

## Functional requirements

### Isolate extension execution

- **R1.** Route backend commands, middleware, hooks, providers, harness callbacks, and other host-invoked extension functions through an extension owner. Inventory every executable contribution and context surface before declaring isolation complete. Renderer JavaScript remains owned by its existing webview boundary.
- **R2.** Move extension entry import, top-level evaluation, extension-supplied validation, and normalization callbacks off the API thread, including startup discovery, install, update, explicit Reload, and the development adoption loop. Trusted host checks may stay in the host when their work is bounded.
- **R3.** Preserve module reuse for an unchanged source version. Repeated reads and commands must not create new module identities or restart harnesses. Retain the existing separation between source imports and adopted project snapshots.
- **R4.** Keep one authoritative database/storage owner. Bridge the supported context methods with the current invocation's project, instance, workspace, generation, permission, and cancellation scope. Do not give an owner a database handle or runtime authentication token.
- **R5.** Preserve the documented behavior of values, errors, middleware order, streams, subscriptions, and nested command calls. Function-valued APIs need explicit remote handles and cleanup; they cannot be silently dropped because they are not serializable. Reject unsupported payloads explicitly.
- **R6.** Bound pending bridge calls, message sizes, subscriptions, and response buffers. Check host-call authority against supervisor-owned invocation state, rather than trusting project or permission claims sent by extension code. Expensive host-side file work and serialization must be measured and removed from the API loop where necessary.
- **R7.** Start processes with the filtered environment required by ADR 0058. Supported harness authentication must have a documented, tested path through the existing approved capability/connection model or the capability design required by that ADR. Do not ship an undisclosed harness regression as an isolation improvement.

### Own cancellation and recovery

- **R8.** Give every invocation and candidate preparation a cancellation scope and an owner. Cancellation must be handled by the supervisor even when extension JavaScript is stuck in a synchronous loop. It must not depend on a callback running inside the stuck owner.
- **R9.** Support terminating and replacing an unresponsive owner. Settle every pending invocation in that owner; report the impact to each affected caller. Since an owner is shared by source version, termination can affect several invocations or projects using that version. It must not restart unrelated owners or the API.
- **R10.** Keep command failures distinct from transport loss and uncertain completion. Termination does not roll back host writes or external effects already accepted. Never automatically retry a mutating command after owner failure or a lost response. A fresh owner loses volatile module state while persisted data remains available.
- **R11.** Track invocation-owned work separately from durable session-owned work. A command ending must not orphan its owned children, subscriptions, or host requests; it must not accidentally kill a separately owned agent session. Shutdown, disable, and uninstall must release their references and stop work that no longer has an authorized owner.
- **R12.** Make recovery explicit and bounded. Repeated owner failures must not trigger an endless restart loop. After failure, a new explicit invocation or retry may start a replacement subject to resource admission; canceled or failed invocations are not replayed.

### Prepare and publish Reload safely

- **R13.** Run source reads, dependency resolution, scanning, hashing, bundling, extension evaluation, and candidate preparation outside the API loop. Reuse the production watcher, signature, staging, and dependency-resolution contracts. Do not add a parallel loader with different source semantics.
- **R14.** Prepare a candidate replacement without changing the adopted project catalog or advancing its generation. Validate contribution metadata, required handlers, and source identity before a bounded host publication step. A preparation failure must not be reported as a successful Reload.
- **R15.** Publish a consistent snapshot so metadata, commands, settings, scheduler, and harness consumers reference the same adopted generation. An older preparation cannot publish after a newer invalidation. Scope invalidation to affected sources and projects.
- **R16.** Keep accepted invocations bound to their original generation until they finish or are explicitly canceled. New invocations use the newly adopted generation after publication. Retire an old owner only when its project/snapshot, invocation, and session references are released. Candidate and retained-owner memory count toward admission, so repeated Reload cannot spawn unbounded retained owners.
- **R17.** Preserve the existing distinction between asset rebuilds and contribution adoption. An ordinary watched edit may rebuild webviews; it must not silently adopt new backend contributions. Explicit Reload, install/update, and the development loop keep their existing adoption roles.
- **R18.** Retain the previous healthy snapshot on a failed replacement according to the current stale-diagnostic contract. Disable and uninstall remove access immediately according to enablement rules; retained source data must not resurrect removed contributions. Asset refresh alone must not restart active harness sessions.

### Schedule expensive work within available resources

- **R19.** Use one runtime resource coordinator rather than independent concurrency limits that each assume the whole machine is available. Account for compiler children, CPU-heavy preparation, extension dispatch, resident owner memory, and overlap during replacement. Idle owners, I/O waits, and long-lived streams need separate lifecycle accounting from active CPU jobs.
- **R20.** Detect available CPU capacity and memory headroom on the machine hosting the backend. Respect process affinity and container quotas where available. A browser client's hardware must not determine a remote backend's build count. Unsupported resource observations must produce a conservative fallback and visible diagnostic metadata.
- **R21.** Estimate job CPU and memory cost from measured, comparable workloads, including compiler internal parallelism and owned children. Use conservative estimates before a source has observations, update them after completion, and avoid rapid concurrency oscillation. Missing measurements must not be recorded as zero or treated as negligible job cost.
- **R22.** Admit a job only when both CPU scheduling capacity and memory headroom permit it. Leave capacity for host requests and the user's other applications. On a one-CPU host, the CPU policy must still allow serial progress rather than reserving all capacity away. Re-evaluate admission when resource availability or job cost changes. A lower budget stops new dispatch; it does not silently terminate an accepted mutating command.
- **R23.** Permit zero new build admissions when memory cannot fit a compiler. Explain the waiting condition and resume when headroom returns. Queue deadlines and explicit cancellation must end waits; a workload that cannot fit must receive an actionable resource failure rather than a forced minimum of one or an unbounded wait.
- **R24.** Bound transient queues globally and per owner by count and retained payload cost. Command queues live within their request/invocation lifetime; existing durable automation queues keep their own contract. When admission or queue capacity is exhausted, return a scoped, machine-readable outcome that clients can explain. Do not install a blanket HTTP request cap as a substitute for execution admission.
- **R25.** Schedule fairly across installed sources and projects. Interactive commands should progress ahead of replaceable background builds, while aging queued work prevents indefinite starvation. Cancellation, owner supervision, and core connection/control traffic must remain serviceable when the extension-work budget is full.
- **R26.** Prevent scheduling deadlocks for nested commands and host calls. A parent waiting for a child invocation must not retain the only admission capacity the child needs. Test this with capacity for one active job. The design must also demonstrate progress for I/O-bound commands and long-lived harness streams.

The prototype's all-but-one-CPU and half-available-memory assumptions are starting hypotheses. They are not production defaults established by this PRD. Before scheduler rollout, record the selected reserves, cost fallback, queue capacities, deadlines, and adjustment rules with measurements on the hardware matrix below. The existing maximum of four may remain a temporary rollout ceiling, but must not replace hardware/cost admission or be described as the optimal count.

### Cancel obsolete builds and retain working output

- **R27.** Keep one desired revision for each installed-source/view build target. Coalesce queued edits using the existing watcher behavior and remove superseded queued jobs before they spawn a compiler. The existing 100 ms watcher debounce remains the comparison baseline.
- **R28.** Cancel an active obsolete build when its result is no longer needed by any adopted or candidate generation. Stop its compiler process and reclaim its resource reservation only after exit. A source used by multiple projects must not lose a build still required by another live reference.
- **R29.** Tag preparation and output by source revision and preparation operation, retaining the adopted catalog generation where applicable. Check those identities at publication, including races between success, cancellation, and a later edit. Obsolete output must never replace current output or clear a newer failure diagnostic.
- **R30.** Publish successful build output through staging with its matching metadata/signature. Failed, canceled, or partial output must not replace a working bundle. Repair clears the relevant failure only after the repaired revision succeeds. Unchanged saves must continue to reuse output without compiler work.
- **R31.** Clean canceled staging files, listeners, queue entries, process handles, and resource reservations. Preserve the ownership rules for runtime caches and extension data; temporary build files are not project documents. Shutdown must not leave compiler or preparation processes running.

### Explain the affected operation

- **R32.** Reuse existing command, build, diagnostic, and connection models wherever their meanings fit. The UI must explain loading, waiting for resources, running/building, cancellation, failure, retained working output, and successful adoption. Add a stored field or public status only where the current owner cannot express the needed fact.
- **R33.** Expose operation progress, cancellation, failure reasons, and terminal outcomes through the same supported APIs used by the dashboard, CLI, and agents. Cancellation must acknowledge completion or escalation; a disappearing spinner alone is insufficient.
- **R34.** Keep failures scoped to their source, view, invocation, or owner. Use the existing status-bar connection owner for Backend unavailable and reconnect behavior. The warning remains visible when the optional healthy indicator is disabled. Do not add independent polling/reconnect loops to every view.
- **R35.** Preserve loaded navigation and drafts during disconnection. Show that a backend-dependent action cannot complete or has an unknown result, and reconcile on reconnection through existing sync recovery. Do not add an automatic mutation replay queue or claim unsaved edits are durable.
- **R36.** Keep worker counts, process IDs, CPU estimates, and scheduler tuning out of ordinary product flows. Authors and maintainers can inspect them in diagnostics; a person using a tool should need only its operation status and recovery action. UI changes use the shared design system and accessible status/cancel controls.

### Detect and stop sustained CPU use

- **R37.** Attribute CPU use to an extension owner and its owned children during initialization, invocations, and background activity after an invocation ends. Record the observation interval and CPU normalization so one fully used core is distinguishable from exhaustion of all available CPU capacity. An empty command queue must not make ongoing extension computation invisible to resource accounting.
- **R38.** Provide an authorized Stop/Restart operation for the affected extension owner through the host, with equivalent dashboard, CLI, and SDK access. It must work before owner initialization finishes and when no command request is active. Explain which projects and invocations share the owner before applying the action. Stop settles affected calls, reaps owned work, and suppresses automatic redispatch until explicit Restart or re-enable. The supervisor owns this stopped state; ordinary metadata reads and background jobs must not undo an explicit Stop. Keep project enablement and persisted extension data intact.
- **R39.** Bound owner initialization and candidate preparation with supervisor-owned deadlines and cancellation escalation. Select those deadlines from measured startup/preparation phases before rollout; this PRD changes no existing timeout. Sustained CPU use alone does not prove a hang or authorize automatic termination of a mutating command. Define the behavior for legitimate long calculations separately from initialization failure, user cancellation, and process exit.
- **R40.** Specify how resource pressure affects work already running, including background computation and owned child processes. Admission limits only constrain new work; process separation alone does not reduce a runaway calculation's CPU use. Record the supported mechanisms for reducing load or stopping work on each platform, their effect on accepted operations, and any unenforced limits. Do not claim a hard CPU quota from a concurrency count or silently kill accepted mutations to meet a resource estimate.

## Resource policy and implementation decisions

The resource coordinator owns admission state in memory. Existing catalog generations, invocation IDs, source hashes, and cancellation scopes identify work. Reuse these identities rather than introducing a parallel installed-source database or synchronizing a second catalog. This work does not require a product-data migration by itself.

Process separation is the proposed production host, consistent with ADR 0058. Thread workers remain useful benchmark controls. A different production host requires an explicit update to that ADR and equivalent evidence for the ownership and failure requirements above.

Before the corresponding milestone becomes the default, its implementation must resolve these decisions:

| Decision | Required evidence or output |
| --- | --- |
| Serializable contribution and context protocol | Inventory of supported callbacks, schemas, streams, remote handles, nested calls, and cancellation/error parity, including core extensions. |
| Process lifecycle and generation references | Tests for shared sources across projects, Reload during commands and active harness sessions, retired-owner cleanup, disable, uninstall, and replacement failure. |
| Stop and initialization policy | Host-owned Stop/Restart semantics, initialization/preparation deadlines, suppression of automatic redispatch after Stop, and the impact on every project sharing an owner. |
| Resource reserves and cold-job estimates | CPU/RSS and completion measurements for synthetic and real dependency-heavy extensions on constrained and larger hosts. |
| CPU use after dispatch | Attribution during background activity, accounting for owned children, and platform-specific behavior for already-running work under pressure. |
| Queue capacities and waiting deadlines | Retained-memory measurements, overload outcomes, fair dispatch, cancellation, and recovery when resources return. |
| Sampling and adaptation | Observation cadence, handling of missing/stale data, concurrency adjustment behavior, and accounting for resident/child processes. |
| Harness credentials | A supported path that preserves documented authentication while applying the filtered environment, with any API change following versioning rules. |
| Packaged execution | Entry-point inclusion, executable resolution, environment filtering, process shutdown, and native results for every supported target. |

These are implementation release gates, not reasons to ship an inline fallback silently. A callback surface left on the API thread must be named in milestone scope and diagnostics until it is migrated.

## Acceptance criteria

### Functional release gates

| ID | Scenario | Passing behavior |
| --- | --- | --- |
| A1 | An extension runs the fixed CPU workload or an infinite loop. | Health, database read/write, sync delivery, and another extension's command make progress during the work. Cancel and supervisor recovery remain reachable. |
| A2 | An extension performs a genuine asynchronous wait. | Other work progresses; scheduler accounting does not treat an idle owner or an open stream as permanently consuming a CPU job. |
| A3 | Commands overlap across projects and scopes. | Host calls use the correct project, instance, workspace, generation, and signal; no scope crosses into another invocation. |
| A4 | An owner throws, exits, or is terminated during a host write. | Every caller settles with the appropriate failure/cancellation/uncertainty outcome. Persisted results remain correct, no command is automatically replayed, and another owner stays usable. |
| A5 | A command calls another extension with one active-job capacity. | The nested call completes or is explicitly canceled; scheduler admission does not deadlock. |
| A6 | A shared source file changes, including same-size edits and import/dependency changes. | The real watcher and loader rebuild affected views and the emitted bytes contain the expected revision. Unchanged saves launch no compiler. |
| A7 | Five edits occur with confirmed overlap during compilation. | Final output contains the last revision; obsolete queued jobs do not spawn after supersession; unneeded active builds are canceled and reaped. Record the avoided CPU and work counts. |
| A8 | Invalid source is saved, then repaired. | Working bundle hashes remain available with diagnostics after failure. Repair publishes new bytes and clears only the matching diagnostic. |
| A9 | Backend top-level evaluation is slow, throws, or loops during real Reload. | Unrelated probes continue. A bad candidate never replaces the adopted snapshot; candidate cancellation and retry are possible. |
| A10 | Reload races later edits, enablement changes, or uninstall. | Older candidates cannot publish; disabled contributions do not reappear; metadata and handlers agree on the adopted generation. |
| A11 | Active harness sessions span asset rebuild and backend replacement. | Asset work does not restart sessions. Owner references and explicit cancellation determine replacement; old generations and children are reclaimed when no longer referenced. |
| A12 | CPU capacity shrinks, available memory cannot fit a job, or queues fill. | No new work exceeds the declared admission policy; the affected caller can understand and cancel the wait. Returning capacity resumes fairly, without dropping accepted mutations. |
| A13 | API transport disconnects or live sync reconnects repeatedly. | Existing navigation and drafts remain; Backend unavailable appears and clears through the shared connection owner; reconnect backoff is respected and mutations are not replayed. |
| A14 | Runtime shutdown, install/update, disable, or uninstall occurs during queued and active work. | Work is canceled or retained according to its explicit owner, pending calls settle, and no unowned processes, listeners, or queue reservations remain. |
| A15 | The packaged runtime starts an owner and compiler on each supported OS. | It loads the packaged entry, preserves declared dependency resolution, filters the environment, handles errors/cancellation, and stops its owned processes. Source-mode success alone does not pass. |
| A16 | An extension starts a CPU loop in background activity after its command returns. | CPU accounting still identifies the owner. Other operations remain responsive, Stop terminates the owned activity without a live command request, and polling or scheduled work cannot restart it. Explicit Restart restores service with persisted data retained. |
| A17 | An owner loops during initial import or launches an owned CPU-heavy child. | Host-side cancellation, initialization deadlines, and Stop remain serviceable. Resource observations include the child, termination cleans it up, and unrelated owners and project scopes remain correct. |

### Proposed responsiveness targets

The following new product targets apply to the fixed reference workload on a Linux profile with four available CPUs, a four-CPU cgroup quota, and a 16 GiB cgroup memory limit. Record the CPU model, Bun version, and actual memory headroom with every run. These are proposed release targets, not measurements already achieved by the production subprocess implementation or changes to existing CI limits.

| Metric | Start and end | Proposed target |
| --- | --- | --- |
| Unrelated request latency during CPU execution, source preparation, builds, and actual Reload | Driver sends each health/projects/other-extension probe until that probe completes, including any sample finishing after work ends. | Each probe p95 at most 50 ms and maximum at most 100 ms; successful probes must complete while the slow operation is active. |
| Slow command completion | The real command request starts until its successful outcome and expected persisted result are observable. | Median no more than 20% above the paired inline control for identical computation and storage work. |
| Cold build and shared-edit completion | Refresh/edit begins until every required published bundle contains the expected revision, including normal watcher debounce for edits. | Median no more than 25% above the paired current implementation on the same host and source graph. Measure scheduler queue wait separately. |
| Cancel and recover a blocked owner | The client issues cancellation until a fresh command in the affected extension succeeds through the real API. | At most 1,000 ms for the reference infinite-loop case, with no automatic replay of the canceled command. |

Use the existing 1,000,000,000-iteration command and six-view/64-module build fixtures unchanged for these reference comparisons. Include the 250,000,000-iteration initialization case through the real Reload endpoint. Create separate named workloads for additional scenarios rather than shrinking these to pass a target. Cold build means empty build output after API setup; application startup and OS cold-cache measurements are separate.

Measure before and after on the same hardware profile, retain every trial and report sample counts, p95, maximum, completion-during-work counts, errors, and cancellations. Repeat paired cases and alternate their order to expose ordering effects; retain the repeat count and cache/setup conditions. Short edit windows must report maxima even when their percentile sample is small.

Other supported platforms and constrained profiles need their own recorded budgets before their performance gate is enabled. Existing startup budgets, fixture allowances, and workflow timeouts retain their current values. Keep [performance budgets separate from execution allowances](../../adrs/0067-separate-performance-budgets-from-execution-allowances.md).

## Measurement and verification plan

Run functional tests against real owners, compilers, scoped host APIs, and isolated databases. Functional tests prove progress and correctness; named benchmarks own latency/resource thresholds. Do not mock away the event loop, compiler, database, or owner termination in the stress comparisons.

| Dimension | Required coverage |
| --- | --- |
| API and workbench | Health and readiness, database-backed reads and writes, unrelated extension commands, live-sync delivery, navigation, cancel, and existing draft retention. |
| Extension workload | Fixed checksum computation, asynchronous wait control, infinite loop, import failure, CPU activity after a command returns, owned CPU-heavy children, bridge call bursts, streams, nested calls, and simultaneous busy extensions. |
| Editing and adoption | Cold output, unchanged save, shared dependency edit, edits during compilation, invalid source, repair, backend-source evaluation, actual Reload, install/update, and the development adoption loop. |
| Real extensions | Planner plus a dependency-heavy webview extension and a harness with an active authenticated session. Use their normal public APIs and declared dependencies. |
| Hardware | The four-CPU reference profile; one/two available CPU profiles; a memory-constrained runtime; a larger CPU/RAM host; and Linux affinity/container-quota disagreement. Record exact limits and headroom. |
| Platform and packaging | Native supported Linux, macOS, and Windows targets, plus packaged CLI and desktop execution paths required by the [cross-platform PRD](0001-cross-platform-support.md). |
| Lifetime | Repeated invocation and Reload, shared sources across projects, owner crashes, request disconnects, cancellation, disable/uninstall, and shutdown while jobs are active or queued. |

The recording must include source revision and dirty-tree/prototype identity, Bun and OS versions, hardware and container limits, selected policy inputs, job cost estimates, and all queue/dispatch/start/exit/publication events. Record queue wait, execution time, total operation time, CPU time, peak child RSS, resident-owner memory, combined process observations, API event-loop delay, and host-call/database latency. Separate first owner startup from reused-owner invocation.

On platforms where combined memory is sampled, state its interval and whether shared pages are counted more than once. Missing resource observations must be explicit. Track RSS over repeated generations and confirm process/module counts return to the expected live references; a one-time low memory observation is insufficient.

Keep raw JSON, compiler and owner logs, correctness outcomes, and traces for failed runs as CI artifacts. Job cancellation and incomplete runs must retain diagnostics. Use bounded local logging and the existing diagnostic infrastructure; no new product analytics service is required. Do not log command payloads, source contents, tokens, or secret values as scheduler telemetry.

The current local experiments can be reproduced with:

```sh
bun run --cwd packages/pstdio-api perf:extension-isolation
bun run --cwd packages/pstdio-api perf:extension-builds --repeats 3
```

These commands establish controls and expose remaining gaps. Extend them to exercise the production owners and scheduler as milestones land. Packaged smoke tests must use packaged entries and executables; UI changes need shared stories and isolated Playwright validation.

## Delivery sequence and rollout

| Milestone | Scope | Exit gate |
| --- | --- | --- |
| M1 Production owner and command path | Implement the subprocess supervisor, owner-side entry import and contribution metadata, scoped context protocol, command execution, cancellation, host-owned Stop/Restart, CPU attribution, replacement, and packaged entry loading. Document protocol coverage and remaining callback surfaces. | Result/storage/error parity, unrelated-operation progress, process startup/RSS observations, recovery from initialization and background CPU loops, and supported harness credential behavior. The covered path must not import the same entry in the API first. |
| M2 Complete callback coverage and Reload | Migrate all remaining production entry-loading paths and backend callbacks to owners; move source/build preparation off the API; publish candidate replacements through the existing catalog. | No extension entry import/callback remains on the API thread. Real Reload passes responsiveness and snapshot consistency checks, including active sessions and failed candidates. |
| M3 Shared resource scheduling and obsolete-build cancellation | Apply measured CPU/memory admission, queue bounds and fairness across expensive work; cancel superseded compiler work and account for retained generations. | Resource-policy decisions are recorded, constrained-host and nested-call tests pass, obsolete work is reclaimed, and hardware-specific latency/completion results meet their gates. |
| M4 Workbench recovery and default rollout | Complete local progress/diagnostics, cancel/retry actions, backend disconnection behavior, native packaged checks, and installed-user walkthroughs. | Dashboard/CLI/agent parity, accessible UI validation, native evidence, memory/lifetime checks, and release-budget results pass. |

M1 is an implementation milestone, not a declaration that extension execution is fully isolated. Preparation measurements can proceed alongside the protocol inventory, but default rollout requires M2 and M3 so a more responsive event loop does not come at the cost of uncontrolled process/resource growth.

Use internal rollout controls only while comparing behavior. If a default must be rolled back, make that explicit in release/diagnostic state; do not fall back to inline execution automatically after a source fails. Retain the previous valid adopted source and user data across an implementation rollback. No user-facing worker or concurrency switch is required for ordinary use.

The work is complete when the production path, rather than a fixture adapter, passes the acceptance matrix; current runtime/architecture docs describe its actual coverage; supported extension APIs and core extensions retain their contract; and applicable release checks pass. OS sandbox completion follows ADR 0058's own milestones and must be reported separately.

## Risks and mitigations

| Risk | Required mitigation |
| --- | --- |
| Subprocess overhead exceeds worker-thread observations. | Measure resident processes, startup, IPC, and replacement peaks; preserve reuse and use resource admission before broad rollout. |
| Context bridging changes behavior or authorization. | Inventory every surface, retain host-owned invocation scope, test overlapping and nested calls, and follow deprecate-first rules for public API changes. |
| Owner replacement loses volatile state or interrupts other projects. | Bind work to explicit source versions and catalog references; disclose termination impact and retain persisted state without replaying commands. |
| Host services become the next blocking path. | Measure database wait, host-call queues, serialization, filesystem work, and sync delivery; bound bridge work and move demonstrated blocking preparation to its owner. |
| Memory estimates lag allocations or other applications. | Use conservative estimates and fresh headroom, include resident/retained owners, stop new admission under pressure, and make incomplete resource guarantees explicit. |
| Fair scheduling stalls streams or nested commands. | Separate process/session lifetime from CPU admission and test one-slot nested calls and long-lived I/O before enabling the policy. |
| Rapid edits cause cancellation churn or stale publication. | Preserve watcher coalescing, cancel only unneeded work, match source revision at publication, and retain working artifacts on failure. |
| Native process behavior differs from Linux. | Require packaged native execution and cleanup evidence; do not infer cross-platform behavior from the local prototype. |

## Related contracts

- [Extension runtime ownership](../../references/architecture/0010-extensions-runtime.md)
- [Project runtime snapshots](../../references/architecture/0014-project-extension-runtime-snapshots.md)
- [Backend process isolation decision](../../adrs/0058-isolate-extension-backends.md)
- [Temporary compiler subprocess decision](../../adrs/0070-temporary-build-extension-webviews-in-a-child-process.md)
- [API health, readiness, and connection behavior](../../references/architecture/0003-api.md)
- [Dashboard settings and connection indicator](../dashboard/0005-settings.md)
- [Extension API simplification](0011-simplify-extension-apis.md)
- [Storage capacity and recovery](0010-bound-client-storage-and-isolate-sync-failures.md)
- [Local-first sync](0014-local-first-sync.md)
