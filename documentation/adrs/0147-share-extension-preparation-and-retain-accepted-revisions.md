# Share extension preparation and retain accepted revisions

Proposed: 2026-11-09

Status: Accepted for PS-169; platform and performance qualification follows the implementation checks.

## Decision

A lazy pool of at most two worker threads owns expensive extension preparation. One shared queue admits at most
128 pending jobs, with two execution owners and shared coalescing/cancellation. Individual installs with explicit portable
names may overlap when their reserved source and possible target paths are disjoint. Both user and repo destinations,
including conditional Windows escaping, are reserved before manifest scope is known. Lexical and nearest-existing-real
paths protect symlink parents; conservative case/Unicode folding and ancestor conflicts cover filesystem aliases.
Unnamed/nonportable installs, default batches, runtime operations, discovery, watches and recovery remain exclusive on
slot zero. This keeps stateful watchers and module caches under one owner while allowing independent requested installs
to validate concurrently. Resource declarations are part of coalescing identity. An interrupted job retains its execution
owner while its worker retires; a separate retiring resource owner lasts through worker and child exit. The scheduler
selects a replacement before returning interrupted work to the waiting queue, preserving the 128-pending bound.
Worker failure/cancellation affects its own execution owner; queued owners and a healthy peer remain available. A
synchronous factory failure settles its selected owner and schedules a finite drain of remaining owners. Only slot-zero
lifecycle events restore watches. Actual restoration dependencies rank ahead of unrelated speculative peer work so a
primary loss cannot strand watches or protected inventory; ordinary background continuations retain their prior rank. Pool shutdown retires both workers and all children before final process-owned cleanup.
This two-worker revision was explicitly requested for PS-169 in the implementation conversation on 2026-11-10. One default-install job pipelines at most four active sources, filling each completed slot immediately and
matching the existing four-child webview build cap while overlapping dependency I/O; both share one environment and
cancellation owner. Requested work takes priority over background checks, including retiring a stalled background
evaluation and resuming its request on a replacement worker. Filesystem callbacks retain their background priority. A
foreground default/setup request holds releasable urgency leases on the queued preparation it depends on, including
existing and future jobs. A promoted queued job can overtake unrelated speculative evaluation. Cancelling or completing
a waiter releases only its leases; remaining waiters determine the job priority. Nested work inherits its live scope
without acquiring a self-lease. Completed scopes release their job references. Background admission waits until the next
event-loop turn so foreground continuations can enqueue their next step before speculative work resumes. Activation,
acceptance, ownership checks and rollback run at requested priority even when startup prepared their candidates in
background. Registration carries that priority through its live notifications/imports, so foreground inspection cannot
repeatedly retire an in-progress adoption. A registration retains admission across host database awaits; nested
dependencies share its continuation owner, released on success, failure or client stop. Unrelated background jobs resume
after registration; idle reservations do not keep a CLI alive. First-time preparation needed by live imports also runs
at requested priority. Watcher initialization and reconciliation never gate adoption, for either source-specific or
global refresh; explicit watcher readiness remains separately observable. Identical jobs share an operation while
callers retain independent cancellation. Source-watch registration sends only install name, source path and source hash;
changing database feedback cannot create distinct registrations. Each source/root watcher owns one running registration
and one coalesced pending generation. Rows are read fresh when a generation starts; distinct paths or any full request
merge into a full refresh. A caller lends its live continuation to its pending generation and running predecessor,
and settles with its own generation. Failure still drains an already requested pending generation; disposal closes
admission, settles pending intent and awaits the running update before removing the watch id. Inventory admits one fresh source inspection per request
at a time and releases its waiter on HTTP or command cancellation. Queue saturation and worker transport/lifecycle failures
remain transient host errors; loaders rethrow them instead of caching empty contributions as source import diagnostics.
The admission bound rejects excess new jobs and never evicts accepted background checks. Webview compilation still uses the fresh child process required by ADR 0070.
Frontend input guards also use fresh children to keep independent graph inspection off the orchestration thread.
Attachment reconciliation admits one source callback at a time. Ordinary filesystem events enter the same background
worker queue immediately, so an edit does not wait behind every newly attached source. Pending attachment checks remain
eligible after worker replacement and are cleared on disposal. Registration changes repair accepted output; attachment
checks and source events own freshness. Frontend callbacks enter the manager immediately, including edits during an
older attachment; the manager owns effective-key serialization. Their provisioning tails still await every earlier
generation, including when a newer frontend fails, so disposal owns all work. A live edit retains its background
continuation across frontend host awaits,
preventing unrelated speculative work from filling every publication gap. Workspace provisioning follows outside
that reservation, still awaited by the same source generation and disposal owner.
Runtime candidate inspection follows frontend publication and workspace provisioning as separately owned speculation.
It never accepts contributions. A later edit cancels that source's suspended inspection before starting its frontend
refresh; each notification obtains a fresh full runtime key, including dependency and host inputs. A key matching the accepted
revision or the last completed check avoids repeated evaluation. Completion records the actual checked revision identity,
including when preparation observes a newer edit than the key lookup. Own-source hashes do not coalesce dependency-only edits. Disposal cancels and awaits every owned candidate.
Live background continuations overtake unreserved speculation while requested tool operations remain first.
Inventory disk hashes are fresh status inspections. They defer throughout live-edit and restoration continuations, including host
awaits and follow-up admission, so status polling cannot repeatedly retire the validation that produces its feedback.
An admitted status read can finish when a later continuation closes admission to queued reads; that closure cannot
make it infinitely preemptible. They can interrupt unchanged attachment reconciliation and unreserved speculation, keeping inventory and initial tool metadata responsive. Hashes are bound to source id/path; inventory then rereads current database
feedback and inspects replaced sources before responding. No cross-request hash cache is introduced.
Root registrations carry their existing app-home or project-directory owner to the worker. The watcher creates missing child directories one level at a time and never recreates the owner; a queued attachment or worker restoration cannot resurrect a deleted project. Missing-owner failure leaves other live roots watched.

Watcher restoration reserves its host/database admission gap before speculative work resumes. Its watch-update jobs
keep explicit background priority and share that reservation; restoration does not retire the replacement worker.
A private restoration admission phase completes watcher lookup and dependent registration before resuming older
background continuation work on the replacement worker. After watching, attachment hashes compare current own-source
bytes with the accepted revision’s preparer-computed hash. Caller-supplied database versions may be opaque. Offline changes enter live-edit admission immediately; unchanged sources retain
the complete frontend checks, including dependency and compiler input inspection.
Source watcher owners retain the last observed own-source hash across worker replacement. Reattaching the same edited
bytes still performs a fresh frontend/dependency check, but uses background attachment admission rather than repeatedly
borrowing live-edit urgency from an intentionally older accepted runtime. First unseen offline content remains a live
edit. Ordinary source/dependency notifications remain live even when the own-source hash is unchanged. Native directory
metadata notifications can name a nonexistent child with the same basename as the watched root. The watcher distinguishes
only that change-event shape using lstat; real entries, including dangling symlinks, and unknown filesystem errors remain
source events. Pending source events win over metadata events across debounce and running checks, including failures.
Metadata events still perform fresh frontend/dependency reconciliation; only a fresh own-source hash matching the last
observation uses background attachment admission. Changed or unknown hashes retain live admission. This bounded
per-registration history is pruned with removed sources; late events cannot recreate a removed registration.

Inspection and compilation share at most four host-owned leaf slots across both workers (or fewer on a smaller host).
Orchestration never holds a slot across nested work. A waiting child reports its dependency to the scheduler: a requested
operation can retire a lower-urgency peer holding its needed permits, even after the request has entered a worker.
Admission commits permit ownership before notifying the scheduler, and retirement is published before abort callbacks.
Pending commands release their queue ownership on cancellation; running permits last through child exit. This cap does
not include dependency-install or other preparation commands and is not an aggregate-memory qualification. Each guard
collects inputs again. The host owns command children and file-captured output; structured requests use Buffer-backed
stdin, leaving no worker-owned request file after retirement. Queued cancellation is checked again after admission.
Packaged inspection uses a dedicated private CLI fast path before API boot, clears `BUN_BE_BUN`, and returns one JSON
digest. It imports only the hashing implementation, avoiding server startup and preparation recursion. The six private
extension preparation contracts and the pure API inspector are recorded in the
[package ownership map](../references/architecture/0013-package-boundaries.md); their exact export limits
include these modules rather than exposing arbitrary runtime files.

The API retains database writes, permissions, enablement, activation, and live callbacks. The worker returns data and
artifact descriptors. It does not open the application database. A worker thread is a performance boundary, not a
security sandbox.

Persist compatible accepted descriptors separately from mutable source folders. A descriptor names immutable runtime
source, its resolved dependency closure, and complete managed webview output. Static dependency traversal follows
resolved export and imports subpaths, including conditional entries. Each inspection shares file reads only within that
operation; before/after guards create fresh readers and keep at most 64 MiB of inspected source bytes. Overlapping entry
graphs visit each module once per inspection; the parse cache retains at most 4,096 paths. Frontend inspection starts
from every managed view, follows stylesheet imports/assets and browser package replacements, and includes implicit JSX
runtimes. Browser-only opaque expressions retain local assets without expanding unrelated Node dependencies.
Import/require calls also scan Bun-normalized constant and conditional expressions. Import attributes retain a
transitive Node execution context for [build-time macros](https://bun.com/docs/bundler/macros), including local and
escaping helpers. Failed normalization keeps the conservative fallback. Opaque resolution retains the declared closure.
It retains reachable modules and complete packages for asset readers or opaque dynamic resolution. Identity includes
those source and dependency bytes, preparation format, extension API, platform, architecture, and the runtime cache
host key. That single host key binds the Bun version and revision, executable path, and executable build stamp.
An unchanged host reuses acceptance after restart; a replaced executable cannot accept artifacts prepared by its predecessor.
Acceptance compares the complete runtime/webview state. A concurrent runtime-only acceptance can be completed with
validated webviews of the same revision; a conflicting or older webview state cannot replace it.

Snapshots preserve a sparse mirror of canonical filesystem paths, including exact extended compiler configurations and
modules outside the extension folder. Compiler aliases, absolute paths and file URLs resolve before copying. Physical
dependency bindings remain relative to their importer, so nested and root packages with the same name keep their
separate identities. Repeated identical bindings share one link; conflicting bindings reject preparation. Opaque imports
resolve their declared closure from the importing module's directory. Runtime load identity includes every accepted
revision input, including own modules reached through aliases. Frontend inspection follows inherited custom JSX runtimes
regardless of the first module's extension and retains explicit per-file JSX pragmas.

Warm reads check the descriptor and required artifact files without hashing source or starting a worker. Background
inspection detects offline edits. Explicit adoption validates the candidate and its webviews before replacing the
accepted descriptor. Activation publishes the validated output, including shared chunks and CSS. Candidate webviews
compile together in one fresh child. First-time raw-source enablement completes the same frontend batch under one source
owner. Reporting waits are followed by fresh whole-set validation, source checks and complete-state acceptance. Retired
per-view reporters cannot replace that accepted set. Later background checks inspect the same complete batch identity;
unchanged accepted views are neither rebuilt nor reported again as singleton artifacts. Successful changed sets use the
same guarded reporting and complete-state acceptance. A failed set reports through the existing view feedback and
retains every previously accepted view; successful siblings cannot publish a partial update. Retired attempts cannot
overwrite either set. Frontend identities include the selected source graph and compiler configuration, so unrelated
sibling or lockfile-only edits do not invalidate a view. Resolved aliases and inherited JSX settings use their selected
modules and implicit runtimes; they do not alone expand every declared dependency. Unresolved or invalid compiler
configuration retains the conservative fallback. Manifest and physical lookup memoization lasts for one inspection only.

Frontend refresh reads contribution metadata from the accepted runtime. Its freshness key combines that runtime id
with current own-source bytes, while whole-frontend dependency and compiler guards still inspect fresh inputs. A later
check receives a fresh serialized validation after any active check with the same key. If its effective source identity
changes, it settles the old admission before joining the current key. Foreground and live-background owners lend and revoke their respective urgency across
those predecessors; disposed managers cannot start queued validation.

Prepared webview URLs use the published per-view identity rather than the database revision announced during guarded
success reporting. A sibling marker survives replacement of the serving directory and changes atomically after its
files are published. Accepted-output repair checks both that marker and the serving signature. Legacy cache preparation
initializes a missing marker exclusively; it cannot overwrite an established publication. Once the complete accepted
set is published, a separate conditional notification records its deterministic state and wakes dashboard readers.
Unchanged output and serving repair do not create new publication versions.
Dependency hashing preserves the same byte order while prefetching at most eight files of up to eight MiB each as
observed at admission; concurrently growing files can exceed that size. This bounds ordinary read-ahead, not total
worker memory. Larger files stream in one-MiB chunks when consumed. Failed inspections drain outstanding reads before
staging cleanup. Runtime and frontend guards each collect fresh inputs before and after their builds. Immutable copies
use best-effort copy-on-write with an ordinary-copy fallback. A manager build reuses its initial input inspection for
artifact identity; the fresh post-build inspection and publication guards still reject source or dependency changes.
Missing serving files are repaired from accepted artifacts without evaluating mutable source. Repository fallback
frontend dependencies use the same prepared source context for compilation and graph fingerprinting. Batch guards
inspect every selected context freshly before and after building; single-view guards use the same resolution rule.
Owned temporary shells are tracked for recovery, and failed inspections drain started groups before cleanup.

Managed installs retain their candidate in staging until registration starts. A durable intent precedes the filesystem
swap; its operation token prevents an obsolete rollback from replacing a newer source with identical bytes. Failed
publication restores the previous registration and accepted descriptor. Install intents remain worker-owned until the
API receives and claims their returned handles; a cancelled batch can therefore recover completed members whose results
were never delivered. A failed default request also attempts every rollback for already delivered candidates before
returning the original failure. Returned intents and checkout leases belong to the API process, so worker replacement
cannot remove them. Operation claims precede filesystem renames, allowing recovery of an interrupted swap. Final cleanup
waits for API registration owners to settle. A shutdown that retires a pending harness lookup retains its durable queued
dispatch claim for recovery instead of consuming it as a tool failure. Provider discovery reports a temporarily
provisioning project as unavailable. Restart recovery settles orphaned intents according to acceptance. Default
preparation and registration share one queue operation. The last configured entry for a resolved user install target
wins before preparation, avoiding superseded deferred registrations.

Process leases protect every imported revision for the process lifetime, including files still used by callbacks or
running agents after a catalog replacement. Background maintenance retains accepted revisions and live leases, and
removes unreferenced artifacts after a one-hour grace period. Maintenance quarantines retired trees under its lock and
deletes them outside the lock. Uncertain process liveness retains files conservatively.

## Alternatives and consequences

- Promise scheduling on the API thread leaves synchronous inspection on the request event loop.
- A worker per extension increases thread and memory use with the installed set.
- A shared subprocess adds isolation and transport overhead that this performance scope does not require.
- Retaining source symlinks cannot preserve accepted runtime assets or dependencies through offline edits.

A preparation worker can fail independently of API request handling. Pending operations receive an error, watcher owners
restore their registrations, and later work can start a replacement worker. Cancellation force-terminates a worker whose
module evaluation cannot settle. The API owns preparation subprocess admission and kills its registered process trees
before retirement. Host-managed worker liveness markers make filesystem lock claims recoverable after termination.
Existing accepted callbacks continue in the API. Native process crashes remain outside this boundary.

Worker diagnostics use stderr. The CLI owns stdout, including machine-readable JSON output, and an idle preparation
worker does not keep a finished CLI command alive.

Executable builds explicitly include worker entrypoints and share chunks to avoid duplicating the API bundle. Packaged
checks must cover worker startup, dashboard assets, offline edits, and warm usable tools on the supported platforms.
Existing resource and startup budgets remain unchanged.

## Runtime import identity

[Temporary Bun import identities](0144-temporary-bun-runtime-import-identities.md) records the pinned runtime failure,
workaround, limitations, and removal condition. [Temporary compiled dependency
resolution](0145-temporary-compiled-bun-dependency-resolution.md) records the separate bare-import ambiguity and
conservative physical binding retention.

Editable skill files retain their existing canonical installed paths. Skill editing and workspace provisioning
deliberately observe that live content; accepted runtime callbacks, dependencies, and webview artifacts remain
immutable.

## Size authorization

Decision request `01a1c24d-1b1a-7bb2-bef3-b3080cf2fc1a` (PS-169, approve implementation size) recorded an estimated
5,300–7,600 added lines and smaller alternatives. The user directly replied “approved” in the implementation
conversation on 2026-11-09 before code was written. The implementation report retains that request and the linked ticket
plan; the agent has not answered its own saved request.

Recovery stage and install-intent records retain the host-created worker liveness marker. Live peer threads cannot
recover each other's work; terminated-thread markers disappear before recovery. Host handoff clears the marker. Legacy
unmarked owners remain conservative until process exit. Concurrent record disappearance is an expected recovery race.
Singleton and batch artifact publication both lock and recheck the completion record before replacing shared output.

Repo-scoped defaults retain their validated installation receipts through project setup. The existing source registrar owns publishing the complete prepared runtime/frontend revision and committing or rolling back that receipt before discovery reads the promoted folder. Discovery must not replace this complete accepted revision with a runtime-only snapshot and repeat frontend preparation on the first metadata request.
