# Store general resource anchors in the host

Proposed: 2026-10-05

Status: Accepted for the host and SDK stage of PS-490.

## Context

Resource links are shared plumbing under [MISSION.md](../../MISSION.md). Extensions own their content, but workspace and session records previously owned separate anchor arrays. Other resource pairs had no shared store or reverse query.

## Decision

Use one project-scoped host table for directed edges. Project, owner, local kind, and ID define each endpoint. Store each pair once; role and supported reference details can change. Incoming queries read the same edge. Source and target indexes support bounded, stable queries.

Expose the same service through the public SDK, HTTP and CLI. Resource owners declare optional anchor validators. The host runs both owners before writing a batch. A disabled owner blocks explicit changes. Removal is allowed after uninstall. Validators cannot write links through their context. Links grant no content access and do not copy extension domain records.

Creation writes workspace/session anchors in the resource transaction. Committed owner removal cleans up both endpoint directions before publishing its event. Workspace deletion cleans up in its own transaction. Project deletion cascades through the table. External resource storage cannot share that transaction: a racing link may survive removal. Queries return stored references without resolving content, so missing owners and endpoints remain readable and removable.

The migration copies only known owners: explicit extension IDs, host kinds, and the three legacy Planner kinds. It preserves roles and relationship metadata, keeps the last repeated pair, and drops unknown owners and cross-project refs. Data backfill SQL is hand-written inside the generated schema migration, as explicitly approved in PS-490 on 2026-10-06. The old array columns are dropped. Old SDK methods and read fields project from the canonical store until extension adoption. There is no dual write.

## Alternatives

Per-resource arrays repeat storage and cleanup and require scans for backlinks. Mirrored extension collections create competing owners. A registry of all domain records would move content ownership into the host. These alternatives do not fit the mission.

## Release order

1. Host and SDK, with legacy projections and independent packaged fixtures.
2. Shared link picker and related-resource controls.
3. Planner and Artifacts adopt the released SDK. Planner supplies its attempt guard and internal resource declarations.
4. Remove legacy methods and projections.

The SDK/API contracts and extension sources must change in separate PRs. Alpha permits breaking cleanup without a deprecation window, as explicitly decided in PS-490 on 2026-10-06. This does not waive the ordered release.

See the [resource-anchor contract](../references/architecture/0024-resource-anchors.md) and [PRD](../requirements/platform/0006-resource-linking.md).
