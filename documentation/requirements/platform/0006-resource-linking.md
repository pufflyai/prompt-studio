# General resource linking

Status: Partly delivered. The host/SDK and shared UI stages are released. First-party adoption and legacy cleanup remain proposed. See the [delivery record](#delivery-record).

## Product need

People and agents need to connect outputs from different tools without copying their content. A ticket can link to an artifact as a result, and the artifact can show that incoming relationship. The host owns identity, durable edges, project scope, queries, and sync. Extensions own content, discovery, navigation and domain rules.

## Requirements

- Support directed links between resources in one project, including different owners with the same local kind and ID.
- Store each pair once. Query outgoing, incoming, or both directions with roles and bounded cursor pagination.
- Expose SDK, HTTP, CLI and dashboard operations with equal permissions.
- Make identical writes and missing removals no-ops. Preserve unrelated concurrent links.
- Preserve known legacy workspace/session anchors, roles, and relationship metadata in one migration. Drop unknown owners.
- Keep workspace/session creation and initial links atomic.
- Run owner validators before explicit changes; reject the entire batch if any owner rejects it. Planner must protect managed-attempt links.
- Reject mutations touching disabled owners. Allow stale removal after uninstall. Disabling preserves links.
- Clean up incoming and outgoing links on committed resource removal. Missing or unresolvable resources show stored references, offer removal, and never crash a view.
- Let people search, link, open, and remove relationships through shared workbench controls.

## Acceptance

1. Link a ticket to a published artifact with role result. Both pages show and open the relationship after reload.
2. Two independent extensions use the public service without reading one another's storage.
3. Repeat writes, change roles, add concurrently, and remove repeatedly without duplicate rows or no-op events.
4. Migrate known legacy refs and preserve atomic managed-attempt creation. Generic unlink respects Planner guards.
5. Reject cross-project changes and disabled-owner mutations without partial writes. Clean up committed removals and keep unavailable entries usable.
6. Perform the same link flow in the dashboard and CLI.

## Delivery

Four ordered PRs are required: host/SDK, shared UI, first-party extensions using the released SDK, then legacy cleanup. The host stage cannot change extension sources in the same PR. Follow [ADR 0061](../../adrs/0061-project-resource-anchors.md).

## Non-goals

Cross-project links, public sharing, content access grants, domain record registries, ticket dependency replacement, graph views, new roles, activity feeds and notifications.

## Mission test

Linking helps people reuse tool outputs. Most extensions need shared link persistence and scope. People get searchable controls; agents get the same operations. Stable identities preserve extension ownership and remote execution.

## Delivery record

Checked on 2026-10-18 against main commit `45580feb`. The newest stable release is `pstdio@0.43.1`.

| Stage | State | Main implementation | Availability |
| --- | --- | --- | --- |
| 1. Host/SDK | Delivered | #918: `packages/pstdio-db/src/services/resource-links.ts`, migration `0037_nebulous_galactus.sql`, HTTP routes in `packages/pstdio-api/src/features/resource-anchors/`, owner policy and validators in `packages/pstdio-api/src/features/extensions/command-environment/`, `pst resources link`, `unlink`, and `links`, and SDK `client.resources` and `ctx.resources` | `pstdio@0.42.0` and `@pstdio/sdk@0.42.0` |
| 2. Shared UI | Delivered | #967: `packages/pstdio-workbench/src/react/resource-links/` and `packages/pstdio-dashboard/src/modules/resource-links/`. #973 removed the automatic header button and kept the command, overlay, and controls. | `pstdio@0.42.0` |
| 3. First-party adoption | Not started on `main` | Planner still writes links through `ctx.sessions.addAnchors` and `ctx.workspaces.addAnchors`. No first-party kind declares `validateAnchors`, so Planner has no managed-attempt guard yet. | None |
| 4. Legacy cleanup | Not started | The session and workspace anchor methods are still present and not marked `@deprecated`. Draft #1175 plans the API cleanup and draft #1184 changes link consistency; neither is merged. | None |

Acceptance 1, 4, and 6 need stage 3. Link changes reach dashboards as `resource_anchor_events` stream events, not as a synced table.

Evidence: unit tests, passed locally on 2026-10-18: `packages/pstdio-db/src/services/resource-links.test.ts` (owners, pagination, atomic creation, cleanup of both directions on deletion) and `packages/pstdio-db/src/db/resource-anchor-migration.test.ts`. The packaged smoke `packages/e2e/src/packaged/packaged-resource-links-smoke.test.ts` uses two independent fixture extensions and runs in the full CI stage; it was not rerun here. No Planner-to-Artifacts journey has been run.
