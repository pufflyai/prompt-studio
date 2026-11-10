# Share extension preparation and retain accepted revisions

Proposed: 2026-11-09

Status: Accepted for PS-169; platform and performance qualification follows the implementation checks.

## Decision

One lazy worker thread owns expensive extension filesystem work, discovery, watches, downloads,
dependency preparation, candidate evaluation, and build preparation. Its queue admits at most
128 pending jobs and executes one preparation job at a time. One default-install job pipelines at most two active sources, filling each completed slot
immediately and preserving the existing bounded overlap of dependency/build children;
both share one environment and cancellation owner. Requested work takes priority over background checks, including retiring a stalled background
evaluation and resuming its request on a replacement worker. Filesystem callbacks retain their
background priority. A foreground default/setup request holds releasable urgency leases on the queued preparation
it depends on, including existing and future jobs. A promoted queued job can overtake unrelated
speculative evaluation. Cancelling or completing a waiter releases only its leases; remaining
waiters determine the job priority. Nested work inherits its live scope without acquiring a
self-lease. Completed scopes release their job references. Background admission waits until
the next event-loop turn so foreground continuations can enqueue their next step before
speculative work resumes. Activation, acceptance, ownership checks and rollback run at requested
priority even when startup prepared their candidates in background. Registration carries
that priority through its live notifications/imports, so foreground inspection cannot repeatedly
retire an in-progress adoption. First-time preparation needed by live imports also runs at
requested priority. Watcher initialization and reconciliation never gate adoption, for either
source-specific or global refresh; explicit watcher readiness remains separately observable. Identical jobs share an operation while callers retain independent
cancellation. Webview compilation still uses the fresh child process required by ADR 0070.

The API retains database writes, permissions, enablement, activation, and live callbacks. The
worker returns data and artifact descriptors. It does not open the application database.
A worker thread is a performance boundary, not a security sandbox.

Persist compatible accepted descriptors separately from mutable source folders. A descriptor
names immutable runtime source, its resolved dependency closure, and complete managed webview
output. Static dependency traversal follows resolved export and imports subpaths, including conditional
entries. Each inspection shares file reads only within that operation; before/after guards create
fresh readers and keep at most 64 MiB of inspected source bytes. Overlapping entry graphs
visit each module once per inspection; the parse cache retains at most 4,096 paths. Frontend inspection starts
from every managed view, follows stylesheet imports/assets and browser package replacements,
and includes implicit JSX runtimes.
Opaque resolution and custom/extended JSX configuration retain the declared closure. It retains reachable modules and complete packages for asset readers or opaque dynamic
resolution. Identity includes those source and dependency bytes, preparation format, extension API,
Bun version, platform, and architecture. Acceptance compares the complete runtime/webview state. A concurrent runtime-only acceptance
can be completed with validated webviews of the same revision; a conflicting or older webview
state cannot replace it.

Snapshots preserve a sparse mirror of canonical filesystem paths, including exact extended
compiler configurations and modules outside the extension folder. Compiler aliases, absolute
paths and file URLs resolve before copying. Physical dependency bindings remain relative to
their importer, so nested and root packages with the same name keep their separate identities.
Repeated identical bindings share one link; conflicting bindings reject preparation. Opaque
imports resolve their declared closure from the importing module's directory. Runtime load
identity includes every accepted revision input, including own modules reached through aliases.
Frontend inspection follows inherited custom JSX runtimes regardless of the first module's
extension and retains explicit per-file JSX pragmas.

Warm reads check the descriptor and required artifact files without hashing source or starting
a worker. Background inspection detects offline edits. Explicit adoption validates the candidate
and its webviews before replacing the accepted descriptor. Activation publishes the validated output, including shared chunks and CSS. Candidate webviews
compile together in one fresh child. First-time raw-source enablement completes the same
frontend batch under one source owner. Reporting waits are followed by fresh whole-set
validation, source checks and complete-state acceptance. Retired per-view reporters cannot
replace that accepted set. Later background checks inspect the same complete batch identity;
unchanged accepted views are neither rebuilt nor reported again as singleton artifacts.
Successful changed sets use the same guarded reporting and complete-state acceptance. A failed
set reports through the existing view feedback and retains every previously accepted view;
successful siblings cannot publish a partial update. Retired attempts cannot overwrite either set.
Frontend identities include the selected source graph and compiler
configuration, so unrelated sibling or lockfile-only edits do not invalidate a view. A manager build reuses its initial input inspection
for artifact identity; the fresh post-build inspection and publication guards still reject
source or dependency changes. Missing serving files are repaired from accepted artifacts
without evaluating mutable source.

Managed installs retain their candidate in staging until registration starts. A durable intent
precedes the filesystem swap; its operation token prevents an obsolete rollback from replacing a
newer source with identical bytes. Failed publication restores the previous registration and
accepted descriptor. Install intents remain worker-owned until the API receives and claims their returned handles;
a cancelled batch can therefore recover completed members whose results were never delivered.
A failed default request also attempts every rollback for already delivered candidates before
returning the original failure.
Returned intents and checkout leases belong to the API process, so worker replacement cannot
remove them. Operation claims precede filesystem renames, allowing recovery of an interrupted
swap. Final cleanup waits for API registration owners to settle. A shutdown that retires a pending
harness lookup retains its durable queued dispatch claim for recovery instead of consuming it
as a tool failure. Provider discovery reports a temporarily provisioning project as unavailable. Restart recovery settles orphaned
intents according to acceptance. Default preparation and registration share one queue operation. The last configured entry for
a resolved user install target wins before preparation, avoiding superseded deferred registrations.

Process leases protect every imported revision for the process lifetime, including files still
used by callbacks or running agents after a catalog replacement. Background maintenance retains
accepted revisions and live leases, and removes unreferenced artifacts after a one-hour grace
period. Maintenance quarantines retired trees under its lock and deletes them outside the lock.
Uncertain process liveness retains files conservatively.

## Alternatives and consequences

- Promise scheduling on the API thread leaves synchronous inspection on the request event loop.
- A worker per extension increases thread and memory use with the installed set.
- A shared subprocess adds isolation and transport overhead that this performance scope does not require.
- Retaining source symlinks cannot preserve accepted runtime assets or dependencies through offline edits.

The shared worker can fail independently of API request handling. Pending operations receive an
error, watcher owners restore their registrations, and later work can start a replacement worker.
Cancellation force-terminates a worker whose module evaluation cannot settle. The API owns
preparation subprocess admission and kills its registered process trees before retirement.
Host-managed worker liveness markers make filesystem lock claims recoverable after termination. Existing accepted callbacks
continue in the API. Native process crashes remain outside this boundary.

Worker diagnostics use stderr. The CLI owns stdout, including machine-readable JSON output,
and an idle preparation worker does not keep a finished CLI command alive.

Executable builds explicitly include worker entrypoints and share chunks to avoid duplicating
the API bundle. Packaged checks must cover worker startup, dashboard assets, offline edits, and
warm usable tools on the supported platforms. Existing resource and startup budgets remain unchanged.

## Runtime import identity

[Temporary Bun import identities](0144-temporary-bun-runtime-import-identities.md) records the
pinned runtime failure, workaround, limitations, and removal condition.
[Temporary compiled dependency resolution](0145-temporary-compiled-bun-dependency-resolution.md)
records the separate bare-import ambiguity and conservative physical binding retention.

Editable skill files retain their existing canonical installed paths. Skill editing and workspace
provisioning deliberately observe that live content; accepted runtime callbacks, dependencies,
and webview artifacts remain immutable.

## Size authorization

Decision request `01a1c24d-1b1a-7bb2-bef3-b3080cf2fc1a` (PS-169, approve implementation
size) recorded an estimated 5,300–7,600 added lines and smaller alternatives. The user directly
replied “approved” in the implementation conversation on 2026-11-09 before code was written.
The implementation report retains that request and the linked ticket plan; the agent has not
answered its own saved request.
