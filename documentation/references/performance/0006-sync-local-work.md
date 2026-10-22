# Sync and local work

PS-905 removes repeated full-owner encoding from sync and checkpoint preparation.
The [storage scale diagnostic](0005-storage-scale-diagnostic.md) owns the fixed
workloads, timing window and release contract. No performance acceptance has been
established for the PS-905 implementation yet.

## Work boundaries

| Operation | Behavior |
| --- | --- |
| Unchanged status | Check the durable revision; reuse a deletion-aware comparison for the same local and remote revisions. No state fetch, Yjs hydration, encoding or cloning. |
| Changed comparison | Capture binary state and its update tail; decode and compare in the background worker. |
| Incoming page | Decrypt and stage at most 16 envelopes per worker job. Validate before local application; verify blobs before durable acceptance. |
| Local save | Append the incremental update and local retry metadata. Return after database commit. |
| Checkpoint | Capture the accepted revision, merge binary updates in the worker, then save with a folded-revision guard. Keep later updates and reject a baseline changed by purge or another checkpoint. |
| Export | Read persisted binary state and its tail, then merge outside the transaction. |
| Save-handler capture | Read persisted checkpoint bytes and the update tail, release the database transaction, and hydrate one staging fork. Encode only the resulting incremental update. |

Checkpoint scheduling retains the latest requested revision while a fold is
pending. After each fold it drains that request if the remaining tail still
crosses the threshold. Flush waits for the complete drain, including requests
received during the first fold. Cached binary state advances only after the
database accepts the checkpoint.

One shared worker bounds background CPU concurrency. An owner awaits each batch
before submitting another. Already queued work runs first. This scheduling rule
alone does not establish acceptable queue drain, memory use or foreground latency.
At most 32 jobs enter the queue. Snapshot factories wait for admission before
reading large binary state. Closing an owner cancels its waiting work and checks
cancellation again inside the durable acceptance transaction.

Received batches also validate against the captured local revision, since local
predecessors can reveal content that is not visible in the relay replica. Verify
all resulting asset bytes, then retry preparation if a local commit changed that
revision before acceptance. Unrelated existing causal gaps can resolve separately.

The existing extension-wide wire and document identities remain. First local
writes after restart still hydrate that owner. Applying a validated incoming
batch still updates the local Yjs document within its durable transaction. Both
costs must pass the cold/warm edit contract, including the single-owner
100,000-row fixture and aggregate 0.5 CPU profiles. Moving preparation into a worker
alone is not acceptance. If document granularity prevents passing, PS-905 must
record and implement the revised boundary in an ADR coordinated with PS-904
queries/atomic groups and PS-906 migration.

## Functional checks

Targeted tests cover revision invalidation, deletion-only repairs, quarantine,
late offline clients, interrupted replacements, accepted causal gaps surviving
restart/checkpoint, checkpoint races with later edits and purge, failed local
transactions and worker queue drain across ten jobs. A compiled worker probe runs
outside the repository to check embedded entrypoint resolution. The packaged
storage and encrypted-sync smoke tests remain required.

Run the fixed rich and small fixtures from the diagnostic runbook in an
acknowledged exclusive timing window. Save every raw observation, including
failures, plus machine/process inventories, byte counts, queues, memory and drain.
Keep functional fixtures and component observations separate from release evidence.
Each benchmark case or run has an external wall-clock cap of at most 60 seconds;
keep any tighter existing limit. A capped run fails or remains incomplete, with
partial output retained. Do not retry, shrink fixtures or relax product budgets.
