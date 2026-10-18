# API clarity prototype

Measured: 2026-10-17. Experimental contracts; not published APIs.
Used by the storage PRD (`documentation/requirements/platform/0009-standardize-storage-api.md` in the repository),
capacity PRD (`documentation/requirements/platform/0010-bound-client-storage-and-isolate-sync-failures.md` in the repository)
and API PRD (`documentation/requirements/platform/0011-simplify-extension-apis.md` in the repository).

This is a historical design experiment from 2026-10-17. Its source is preserved at a fixed Git revision.
The prototype is not part of the current SDK, and its syntax counts are not release acceptance evidence.

## Reproduce the historical comparison

Create a separate Prompt Studio workspace at the experiment revision, then run the commands below
from the printed workspace path. Do not run them in the current SDK checkout.

```sh
pst workspaces create --provider pstdio.worktree --params '{"base":"8b78846c1926eff6dd5a6aa4e873530f0ab5b26a"}'
# Change to the workspace path printed above.
bun install --frozen-lockfile
bun run --cwd packages/sdk prototype:api-clarity --json /tmp/api-clarity-results.json
bun test --cwd packages/sdk ./prototypes/api-clarity
```

The [prototype](https://github.com/pufflyai/prompt-studio/blob/8b78846c1926eff6dd5a6aa4e873530f0ab5b26a/packages/sdk/prototypes/api-clarity/run.ts) runs a ticket-review workflow.
It reads a template, writes drafts/output/source, saves a ticket, adds an attachment, lists sessions,
links the ticket to a session, handles a rejection, consumes a stream, changes settings and saves a view.
Each task gets a fresh fixture. There are three versions:

- [Current](https://github.com/pufflyai/prompt-studio/blob/8b78846c1926eff6dd5a6aa4e873530f0ab5b26a/packages/sdk/prototypes/api-clarity/current.tasks.ts): existing public operations.
  The save already uses a captured revision and guarded commit. File availability stays optional.
  Workspace deletion and saved views already use their modern APIs. It uses only APIs that stay
  supported in 0.44, so session listing pages through `query` instead of the removed `listByWorkspace`.
- [Draft](https://github.com/pufflyai/prompt-studio/blob/8b78846c1926eff6dd5a6aa4e873530f0ab5b26a/packages/sdk/prototypes/api-clarity/proposal.tasks.ts): the PRDs before this experiment.
  Nested notification selectors, `files.open`, manual attachment metadata and manual session paging.
  Explicit command outcomes were already allowed; this comparison uses them.
- [Revised](https://github.com/pufflyai/prompt-studio/blob/8b78846c1926eff6dd5a6aa4e873530f0ab5b26a/packages/sdk/prototypes/api-clarity/revised.tasks.ts): direct notification methods,
  named file handles, guarded-save/attachment helpers and an SDK session iterator.

The [contracts](https://github.com/pufflyai/prompt-studio/blob/8b78846c1926eff6dd5a6aa4e873530f0ab5b26a/packages/sdk/prototypes/api-clarity/contracts.ts) are typed projections of
the surfaces needed by these examples. They are not a complete post-cleanup SDK declaration.
The fixture shares backing objects across projections. The current and revised projections leave out
APIs removed in 0.44; the revised projection does not yet leave out APIs deprecated in 0.44.

## Measurements

Count TypeScript tokens inside each function body, including punctuation and local type annotations.
The [measurement code](https://github.com/pufflyai/prompt-studio/blob/8b78846c1926eff6dd5a6aa4e873530f0ab5b26a/packages/sdk/prototypes/api-clarity/measure.ts) walks parsed token
nodes, including template expressions. Formatting can add optional trailing commas, so keep the
checked-in formatting for reproduction. Imports, signatures, fixture setup and helper implementations
are excluded. Identifiers and literals each count as one token regardless of their length.

Also count object fields and control-flow sites: `if`, `catch`, loops, conditional expressions and
`switch`. JSON output includes call expressions, object nesting and instrumented fixture operations.
There is no weighted clarity score. These counts do not measure learning time, comprehension,
discoverability, network requests, latency, disk use or the size of the public API.

| Task | Current tokens | Draft tokens | Revised tokens |
| --- | ---: | ---: | ---: |
| Complete one notification | 33 | 43 | 16 |
| Complete a notification group | 22 | 39 | 16 |
| Read a package template | 12 | 27 | 14 |
| Write a local draft | 28 | 29 | 16 |
| Write a shared file | 19 | 33 | 19 |
| Edit current workspace source | 28 | 33 | 16 |
| Save a captured ticket | 54 | 54 | 32 |
| Attach a file | 60 | 142 | 39 |
| Read all 63 workspace sessions | 84 | 84 | 45 |
| Link a session to a ticket | 32 | 45 | 36 |
| Read rejection code and data | 46 | 44 | 44 |
| Consume chunks and final outcome | 73 | 54 | 54 |
| Delete a settings override | 18 | 14 | 14 |
| Delete a workspace | 14 | 14 | 14 |
| Save a filter and sort | 65 | 65 | 65 |

The old attachment operation has weaker retry/reference behavior. Its 60 tokens are not a cost
comparison for equivalent durability. The manual draft recipe fails an identical retry after a
successful commit because it rereads a newer base. Fixing that recipe requires additional code.

| Selected burden | Current | Draft | Revised |
| --- | ---: | ---: | ---: |
| Single-notification object fields | 2 | 4 | 0 |
| Single-save object fields | 6 | 6 | 2 |
| Attachment object fields | 3 | 10 | 1 |
| Session-list object fields | 3 | 3 | 1 |
| Resource-link object fields | 3 | 6 | 4 |
| Stream control-flow sites | 2 | 1 | 1 |

## Decisions from the examples

Use separate notification methods:

```ts
// Discarded draft
const result = await ctx.notify.transition({
  selector: { by: "id", id: notificationId }, status: "done",
});
const notification = result.notifications[0] ?? null;

// Revised: Notification | null
const notification = await ctx.notify.setStatus(notificationId, "done");
// Group selection stays explicit: Notification[]
const notifications = await ctx.notify.setStatusByKey(groupKey, "dismissed");
```

Use named file handles. `files.open` adds a descriptor and an awaited acquisition to each example.
`files.package.readText(...)` still takes two more tokens than today's `packageFiles.readText(...)`.
It groups discovery; it does not remove a root concept. Local and workspace availability errors
move into asynchronous operations on bound handles. Their checks still belong in host adapters.
The fixture models that failure but does not prove real root binding or provider behavior.

Keep a single-record convenience method over the same guarded commit:

```ts
const ticket = await ctx.storage.records.read(ticketId);
const result = await ctx.storage.records.save(ticket, nextValue, { operationId });
```

The helper takes the original record and stable operation ID. It forwards the original revision,
returns the full commit outcome and does not reread before saving. Multi-record edits still use
`commit`. Keeping the draft and deciding what to do with a conflict remain caller responsibilities.

Keep an attachment composition helper. Its shorter caller moves hashing, metadata construction,
original-operation lookup and payload validation into shared SDK code. Those operations still run.
It introduces no extra store or durable receipt cache. First attachment creation records
`records.outcome`, `records.read`, `assets.stage`, `records.commit` at the instrumented boundaries.
A completed identical retry records `records.outcome` and `records.read`; it still hashes the entire
supplied file. Avoiding another stage is not a proof of lower transfer cost or disk consumption.
The old memory attachment adapter has a different internal implementation, so operation counts are
diagnostics, not comparable storage-I/O totals.

Add `sessions.iterate(filter)` over paged `query`. It removes cursor bookkeeping from callers while
preserving bounded pages. The fixture reads
63 sessions through two queries, including a live session beyond the first 50 entries. An early break
avoids another query. The prototype supports workspace/status filters; production must support the
full query filter contract, stable cursors and cancellation.

Keep explicit command outcomes for recoverable failures. The draft already permitted this choice.
The prototype does not support replacing all outcome handling with typed exceptions. A throwing
helper remains optional and must carry the complete outcome. Shared stream handling removes the
transport-event branch from this caller; lifecycle handling moves into the adapter.

Keep the existing generic resource-link API, canonical saved-view fields and `workspaces.delete`.
The revised link example leaves owners to the host, which infers them unless they are ambiguous.
It is still longer than the session wrapper because it names both resource types. Saved-view and
delete examples have no token improvement because
their modern forms already exist. The typed browser settings wrapper saves spelling a capability
string; it adds no new settings owner.

## Behavior checked and limits

The historical experiment passed 15 tests and ran all 45 task examples. It uses the actual SDK memory storage
and grouped record engine for saves, conflicts, asset bytes and retained outcomes. Checks cover:

- A stale save preserves the other editor's current value and the original draft branch.
- An identical captured save retries; changing its payload under the same ID fails.
- Attachments retain bytes, parent/name metadata and portable asset references. A completed retry
  avoids staging; changed bytes under the same operation ID fail.
- Notification ID/group calls have different return cardinalities. Missing ID returns `null`.
- Fixture package writes, traversal, undeclared mounts and missing-current-workspace fallback fail.
- Session iteration includes the second page, filters live status and stops on early break.
- The fixture stream settles successfully or reports cancellation before iteration/on early return.
- Rejection data, resource-reference fields and saved filter/sorts survive the example adapters.
- The actual current unwrap helper drops structured rejection details. Current notification
  selectors disagree between context and browser fixtures built from their implementations.

Type checks reject package writes, author expiry, mixed notification selectors, saving without a
captured record and attachment calls without an operation ID.

Notifications, files, queries, links, views and transports use fixtures. Their checks do not prove
real authorization, source-row validation, link events, settings fallback, symlink safety, provider
readiness, relay propagation, cursor stability or backpressure. The stream is a small lifecycle
simulation; it does not connect to HTTP or the webview bridge. Attachment parent existence,
ownership, concurrent deletion, listing, download, ordering and deletion are not implemented.
No capacity, restart, interrupted-transfer, compaction or asset-eviction claim is established.
The capacity PRD's release requirements remain in force.

The examples open each root for one task. Reusing one acquired handle across many reads may change
the comparison. Dynamic root and notification-selector helpers may need extra branching with named
methods. Those cases, real extension migrations and author comprehension remain unmeasured.
Before freezing 0.44 contracts, exercise those maintained callers and the actual adapters. 0.44
adds the new APIs and deprecates the old ones. 0.45 moves extensions to the new APIs on the
published 0.44 SDK and removes everything deprecated in 0.44. Before that adoption, repeat the
workflow and safety checks using published dependencies. Do not use these syntax counts as release
acceptance evidence.
