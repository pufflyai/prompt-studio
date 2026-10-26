# Extension owner rollout

Status: Partial implementation. Default rollout is blocked.

The responsive extension execution PRD is not complete. This change starts its command owner path and resource coordinator, and cancels obsolete webview builds. It does not claim the M1–M4 exit gates or the full acceptance matrix.

## Current execution path

The API's source loader and project source cache use the host loader exported by `pstdio-extensions`. With the internal `PSTDIO_EXTENSION_PROCESS_OWNERS=1` comparison control, that loader evaluates extension entries and runs their function references in Bun subprocesses. It never retries a failed owner by importing the entry into the API. The control is off by default until callback parity, lifecycle references, resource admission, and native evidence are complete.

Owners share unchanged canonical source/load keys, including across project snapshots. Distinct installed paths stay separate. An owner keeps its prepared bundle for explicit recovery after an exit or cancellation, so recovery does not adopt an edit made since the snapshot was loaded. Failed calls are not replayed. Module state resets in the replacement process; host storage remains authoritative.

The supervisor starts from the existing filtered environment and an isolated temporary working directory. Source-mode Bun also disables automatic environment-file loading. The child gets its own temporary `PSTDIO_HOME`, rather than the host's database, descriptor or credentials. Filesystem access is still governed by the OS user. This implements no OS filesystem sandbox; [ADR 0058](../../adrs/0058-isolate-extension-backends.md) remains separate work.

The packaged CLI contains the owner entry. It re-executes the same binary through an internal IPC entry point. App shutdown disposes registered owners before awaiting extension startup work.

## Callback and context inventory

This inventory records transport coverage, not proof of complete behavioral parity.

| Executable contribution | Current coverage | Remaining gate |
| --- | --- | --- |
| Commands and middleware | Remote function references; real API/storage regression coverage | Full middleware, nested-call, uncertainty and overlapping-project acceptance cases |
| Hooks | Remote references in the same source definition | Full event ordering, shutdown and durable delivery evidence |
| Renderer callbacks, resource hierarchy providers | Remote references; renderer JavaScript remains in its existing webview | Full contribution and scoped-context matrix |
| Workspace providers | Function references transport through the same definition | Complete create/resolve/cancel/delete lifecycle checks |
| Harness providers, session callbacks and native sinks | Explicitly rejected by the API rollout loader | Synchronous event-sink behavior, session handles, approved credentials and retirement; no authenticated-session parity claim |
| Entry evaluation and contribution getters | Run in the owner on the covered loading path | Preparation cancellation through supported client APIs and full Reload publication rules |

| Context surface | Current coverage | Remaining gate |
| --- | --- | --- |
| Project, instance/workspace context, invocation values, signal | Host-created invocation values and random callable handles; abort can terminate a stuck owner | Generation references, immediate disable/uninstall revocation and cross-project stress |
| Storage records, KV, collections, scopes, attachments | Host calls; synchronous factories expose deferred objects with asynchronous operations | Full records/assets and migration acceptance matrix |
| IDs, positions, migration IDs, file URLs, middleware result helpers | Explicit local descriptors preserve synchronous return values using existing pure helpers | Full core-extension compatibility run |
| Package/project/workspace/extension files and artifact mounts | Callable transport and byte arrays | Expensive host-file work measurements and all permission/cancellation cases |
| Resources, views, settings, sessions, workspaces, notifications, automation, account | Generic callable transport | Individual method parity and authorization evidence |
| Nested commands, events, logging, navigation | Callable transport; invocation context is bound to host callback handles | End-to-end nested scheduling and delivery cases |
| Process and network APIs | Host callable transport | Child attribution and cleanup under every lifecycle transition |
| Connection streams and asynchronous iterators | Pull-based remote iterator handles | Stream cancellation, sustained-buffer and long-lived-session evidence |
| Terminal sessions | Explicit unsupported-operation error | Synchronous terminal handle and event contract |
| Blob, ReadableStream, custom prototypes, cyclic/nonfinite values | Explicit payload rejection | Required assets/stream adapters before default rollout |

Host capabilities are registered from the host-created context, not resolved from project IDs or permission claims supplied by an extension. Completed ordinary calls release their exported context handles. Session completion promises and prepared invocation handles have separate retention paths, but full remote-result lifetime and provider retirement remain release gates.

## Bounds and recovery

The pilot bounds outstanding incoming and outgoing bridge calls to 128 each, exported handles to 2,048, JSON messages to 2 MiB, byte-array payloads to 512 KiB, and object nesting to 64 levels. Unsupported values fail explicitly. These limits still need retained-memory measurements.

Stop is supervisor-owned and works during import or without a live command. It rejects affected pending calls and prevents that supervisor from dispatching again until explicit Restart. The registry also retains stopped source paths across new load keys. The current control is an internal host module, not yet a supported dashboard/CLI/SDK operation.

The initialization deadline is 10 seconds in the pilot. It is separate from command execution: a legitimate long command has no new execution deadline. User cancellation terminates the shared owner, so every call using that source process can be affected. Termination does not undo accepted host writes. Platform process cleanup uses a POSIX process group or Windows `taskkill /T`; native platform verification is still required.

The registry currently caps retained owners at 16 and releases them at runtime shutdown. Reference-based reclamation of adopted, candidate, invocation and session generations is not implemented. This cap is an explicit pilot bound, not the PRD's memory admission policy.

## Resource coordinator

The coordinator is implemented independently of the production dispatch path. Its tests cover shared CPU/memory reservations, bounded queue counts and retained payload estimates, cancellation, deadlines, fairness, resource recovery and one-capacity nested calls. It is not wired into all owners/preparation/compilers yet, and the existing compiler limit remains in production.

Current candidate policy inputs are a host reserve of up to one CPU (half a CPU on a one-CPU machine), 256 MiB of free memory, 128 queued jobs globally, 16 per source, 8 MiB of queued payload estimates, a 30-second waiting deadline and a 250 ms observation interval. Jobs can receive zero memory admissions. Queue expiry reports `extension_resource_deadline`; overload reports `extension_queue_full`. Running accepted work is not killed when capacity falls.

CPU affinity and root cgroup v1/v2 limits are read on Linux. Delegated/nested cgroup discovery, owned-child CPU/RSS samples, resident owner reservations, cost adaptation, I/O/stream accounting and hardware calibration remain open. Missing observations are recorded as diagnostic metadata. These values are uncalibrated pilot inputs and must not become the default resource policy without the PRD's measurements.

## Webview builds

Each managed build attempt now owns a cancellation controller and private source/output staging directories. A newer signature cancels the obsolete attempt. A compiler releases its existing slot only after it exits; the replacement cannot overwrite its source staging files. Removing a view, uninstalling its source, and manager disposal cancel their attempts. Existing current-signature checks still guard publication and diagnostics. Failed or canceled stages cannot replace working output.

This uses the existing watcher, signatures, source loader and compiler. It adds no parallel source semantics or product data migration. Source scanning, hashing, source staging and publication preparation still need to move off the API loop.

## Verification and remaining rollout work

The unit regressions exercise real Bun owners, synchronous import/computation, binary payloads, storage factories, streams, errors, Stop during import, explicit recovery from adopted bytes, and synchronous helper parity. The API regression uses a real PGlite-backed app and verifies host storage plus unrelated project-read progress. The build regression proves an active obsolete compiler receives cancellation before the latest revision publishes. The packaged serve smoke includes owner startup with declared dependency exports.

These are functional checks, not measurements against the PRD's proposed latency budgets. The fixed checksum/build experiment utilities and their `perf:extension-isolation` / `perf:extension-builds` scripts are absent from this checkout. They must be supplied or recovered before claiming an unchanged paired comparison.

Default rollout still requires the full [snapshot contract](../../requirements/extensions/0001-runtime-snapshots.md), callback and credential parity, retained-generation cleanup, complete resource scheduling, CPU attribution after command completion, public Stop/Restart/progress interfaces, workbench disconnection/draft behavior, native packaged results, installed-user walkthroughs and the hardware measurement matrix.
