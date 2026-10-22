# Temporary Yjs root-name index

Proposed: 2026-10-22

## Status

Accepted for PS-905. This is a temporary dependency workaround. It does not establish performance acceptance or change the document boundary.

## Context

Named shared roots preserve the identity of records and nested values when devices create or edit them offline. Yjs writes the root name into its existing binary protocol. Finding that name should take constant time; encoding a changed field should not search unrelated records.

The fixed 100,000-small-row database diagnostic stopped at its unchanged 60-second cap after only 15,000 rows in the first history round. No complete seed or cold-edit sample exists. A separate profiling run used the same fixture and cap. In its first 30.441 seconds, Yjs `findRootTypeKey` accounted for 28.064 seconds of sampled self time, or 92.192%. The profile is diagnostic evidence, not an accepted timing: profiler overhead and ambient process inventories are recorded in RP-1178.

The workload had committed only 15 groups, before the normal 128-group checkpoint boundary. This branch did not yet contain the PS-904 row projection hook. The profile isolates the cost in incremental update encoding, not checkpoint preparation or query projection.

## External limitation

Yjs 13.6.29 finds a root name by scanning `document.share.entries()` for each encoded root-backed item. Our existing named-root format makes that search grow with the whole owner. Moving full encoding to a worker does not repair encoding of an ordinary local write.

The [upstream implementation](https://github.com/yjs/yjs/blob/main/src/utils/ID.js) still contains this search at the time of this decision, including the development version 14.0.0-rc.29. There is no evidenced dependency upgrade that removes it. An application-level replacement would have to override Yjs internals or duplicate its binary encoder. Changing existing root names or nesting them under new parents would change offline merge identities and require a different migration decision.

## Decision

Use Bun's version-pinned package patch for Yjs 13.6.29. Keep a module-local weak reverse index from a root type to its name. Register roots where `Doc.get` creates them, including the replacement of an initially untyped root with its concrete map, text, or array type. The existing shared-root map remains authoritative.

`findRootTypeKey` uses an indexed name only while the document's shared-root map still maps that name to the same type. Otherwise it retains the original search and remembers its result. Preserve an existing registration when a caller retrieves an alias. The weak index does not retain a destroyed document and has no persisted representation.

Keep the change isolated to the dependency patch, covering its source, ESM bundle, and CommonJS bundle. Application code continues using the public Yjs API. Do not change update bytes, root names, client identities, causal clocks, deletion sets, operation identities, or storage schema.

## Validation

- Freeze binary updates and snapshots produced by the unmodified pinned dependency. Require exact byte equality after the patch.
- Check named maps, texts and arrays, empty and Unicode names, incremental edits, deleted content, decoding before concrete root access, and relative positions.
- Prove normal root encoding does not enumerate unrelated roots. This is an algorithmic work bound, separate from a wall-clock budget.
- Run existing sync and database convergence, invalid-update, rollback, checkpoint, and offline tests, plus affected checks and packaged verification.
- Repeat the fixed full workload only after the product correction, under a fresh acknowledged timing window and the unchanged case cap. Retain both failures and successful evidence. Cold/warm edits, contention, receive fairness, memory, and full application acceptance remain required.

## Limitations

This removes one measured lookup bottleneck. It does not bound full-owner hydration, validation, retained history, or memory. Those costs still decide whether the current owner-wide document boundary is acceptable. Unsupported direct changes to `document.share` take the original fallback path when an indexed binding is no longer valid.

The repository must carry a dependency patch until upstream provides the same property. A dependency version change must apply cleanly and pass the byte-compatibility and offline tests; it must not silently drop this fix.

## Removal

Remove the patch and its Bun `patchedDependencies` entry when a released Yjs version provides bounded root-name lookup with compatible wire behavior. Upgrade the pinned version, retain the compatibility and algorithmic regression tests, and rerun the unchanged fixed workloads. If measured remaining costs require a new document boundary first, that design needs its own migration and cross-record atomicity proof; this workaround is not that design.
