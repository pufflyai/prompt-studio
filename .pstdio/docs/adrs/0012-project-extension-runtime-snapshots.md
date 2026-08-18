# ADR: Project Extension Runtime Snapshots

## Status

Proposed.

## Context

Extension commands, events, schedules, settings, and UI metadata can call loadProjectExtensionRuntime independently. That path imports extension entries with a unique cache key.

Bun retains imported ESM modules for the process lifetime. Controlled testing showed public and private extension commands growing API memory on every call until Docker killed the process with exit 137.

A project extension runtime catalog already caches loaded sources and invalidates them when installed sources change, but command and event paths bypass it.

## Decision

Make the project extension runtime catalog the only owner of normalized project runtime snapshots.

All runtime consumers request a snapshot from the catalog. Concurrent reads share one in-flight load. Normal reads reuse the same module identities. The catalog invalidates affected snapshots when:

- an installed source changes;
- an extension is enabled, disabled, installed, removed, or reloaded;
- linked repository extension roots change;
- dependency state changes.

Invalidation creates a new snapshot on the next read. Old snapshot references may finish active work, but no new work starts from them.

## Rationale

One owner provides a bounded lifecycle and prevents each API route from inventing its own loading policy. Source changes still reload extensions, while ordinary command volume no longer creates permanent ESM identities.

## Rejected Alternatives

- **Periodic garbage collection:** ESM module identities are retained and cannot be safely unloaded.
- **Worker restart after a command count:** This hides the ownership error and disrupts active sessions.
- **Memory limits or larger containers:** This delays the crash without stopping growth.
- **A second command-only cache:** This duplicates invalidation rules and lets metadata and execution disagree.

## Consequences

- Route dependency types gain the runtime catalog.
- Commands, events, schedules, settings, skills, templates, and UI metadata read the same snapshot.
- Invalidation tests become part of extension source watching and enablement flows.
- Memory can still grow after genuine source revisions because Bun retains imported identities, but growth is tied to revisions rather than commands.

## Verification

- A loader counter proves one import per installed source version across repeated commands and events.
- Concurrent requests share one load promise.
- A source refresh produces exactly one new snapshot.
- A command started before invalidation completes against its original snapshot.
- A container soak test shows memory plateauing under repeated unchanged commands.

## References

- [Contextual extension architecture proposal](../product/extensions/proposals/contextual-extension-architecture.md)
- [Project extension runtime snapshots PRD](../product/extensions/proposals/extension-runtime-snapshots-prd.md)
