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

The internal `PSTDIO_EXTENSION_RESOURCE_ADMISSION=1` control, together with process owners, connects the shared coordinator to owner initialization, adopted callback dispatch, trusted preparation and compiler children. It replaces the independent compiler slots on that path. The default path and the fixed four-compiler measurement control retain the existing limit. Resource-policy calibration is separate from the preparation comparison; the benchmark driver explicitly disables this second control.

Tests cover shared CPU/memory reservations, bounded queue counts and retained payload estimates, cancellation, deadlines, fairness and resource recovery. They also exercise two real owners nesting at one-job CPU capacity, Stop during queued initialization, preparation shutdown before spawn, compiler admission with no memory, and cancellation of queued work without terminating an accepted sibling call.

Host callback handles carry the admission scope across IPC. While a callback waits on a host operation, its CPU charge is released and its memory charge remains. A nested owner can use that released capacity. Accepted work resumes even when resource headroom falls; the restored charge prevents new admissions. Several accepted operations can therefore briefly exceed the CPU estimate when their I/O completes together. This is explicit running-work policy, not a hard CPU quota, and it does not kill or replay accepted mutations. Direct extension networking, background JavaScript, durable sessions and dynamic returned-callback attribution still require separate observation/lifecycle coverage.

Current candidate policy inputs are a host reserve of up to one CPU (half a CPU on a one-CPU machine), 256 MiB of free memory, 128 queued jobs globally, 16 per source, 8 MiB of queued payload estimates, a 30-second waiting deadline and a 250 ms observation interval. Jobs can receive zero memory admissions. Queue expiry reports `extension_resource_deadline`; overload reports `extension_queue_full`. Running accepted work is not killed when capacity falls.

Cold estimates are one CPU/64 MiB for initialization or preparation, one CPU/16 MiB of transient memory for invocation work, and two CPUs/320 MiB for a compiler. Invocation queue estimates include 512 KiB of context allowance plus serialized arguments. These are explicit pilot values; resident owners and arbitrary extension allocations are not bounded by those transient estimates. Compiler reaping precedes release; owner failures wait for process exit before releasing their job. Scoped webview errors retain resource deadline codes in their diagnostic cause.

CPU affinity and root cgroup v1/v2 limits are read on Linux. Delegated/nested cgroup discovery, owned-child CPU/RSS samples, resident owner reservations, cost adaptation, I/O/stream accounting and hardware calibration remain open. Missing observations are recorded as diagnostic metadata. These values are uncalibrated pilot inputs and must not become the default resource policy without the PRD's measurements.

## Trusted preparation and webview builds

Each managed build attempt now owns a cancellation controller and private source/output staging directories. A newer signature cancels the obsolete attempt. A compiler releases its existing slot only after it exits; the replacement cannot overwrite its source staging files. Removing a view, uninstalling its source, and manager disposal cancel their attempts. Existing current-signature checks still guard publication and diagnostics. Failed or canceled stages cannot replace working output.

The owner comparison control also moves source/load-key hashing, webview import-graph scans and fallback source staging into a trusted preparation subprocess. The existing implementations now live in `pstdio-extensions/authoring`; the API calls those same functions through the bounded bridge. The preparation process never imports an extension entry. It preserves source working-directory and dependency lookup semantics. Source and packaged entry points share the operation registry. Cancellation waits for process exit before callers clean staging. The pilot preparation deadline is 10 seconds; pressure handling and deadline calibration remain release gates.

The production watcher now forwards new desired revisions while previous compilers run, with its existing 100 ms debounce. Sibling view status reports take turns within one refresh so their conditional writes do not invalidate each other. Replacement refreshes can progress while an obsolete report finishes. Asset publication retains the adopted backend callbacks until explicit source adoption. Shutdown reaps processes again after lifecycle producers have stopped, covering preparation started during early cancellation.

This uses the existing watcher, signatures, source loader and compiler. It adds no parallel source semantics or product data migration. Tree-watch registration, some metadata/convention reads and bounded final publication/normalization still need measurement and complete off-loop coverage.

## Verification and remaining rollout work

The unit regressions exercise real Bun owners, synchronous import/computation, binary payloads, storage factories, streams, errors, Stop during import, explicit recovery from adopted bytes, and synchronous helper parity. The API regression uses a real PGlite-backed app and verifies host storage plus unrelated project-read progress. The build regression proves an active obsolete compiler receives cancellation before the latest revision publishes. The packaged serve smoke includes owner startup with declared dependency exports.

The requester authorized recreating the absent experiment fixtures. The maintained `perf:extension-isolation` and `perf:extension-builds` scripts preserve the PRD's checksum/init counts, six views, 64 shared modules and 100 ms debounce. They use separate HTTP drivers, real API/database/loader/watcher/compiler paths, alternating paired order, raw samples and measured compiler CPU/RSS. The [execution](0030-extension-worker-prototype.md) and [build](0031-extension-build-and-edit-measurements.md) reports distinguish supplied historical evidence from this explicitly versioned recreation. The recreated module density is fixed and documented; no byte-for-byte original-fixture claim is made. Native development results do not pass the missing hardware/platform release matrix by themselves.

Default rollout still requires the full [snapshot contract](../../requirements/extensions/0001-runtime-snapshots.md), callback and credential parity, retained-generation cleanup, complete resource scheduling, CPU attribution after command completion, public Stop/Restart/progress interfaces, workbench disconnection/draft behavior, native packaged results, installed-user walkthroughs and the hardware measurement matrix.
