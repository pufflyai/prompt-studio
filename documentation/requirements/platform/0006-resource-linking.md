# General resource linking

Status: Proposed. Host/SDK stage implemented; shared UI, first-party adoption, and API cleanup remain proposed.

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

Four ordered PRs are required: host/SDK, shared UI, first-party extensions using the released SDK, then legacy cleanup. The host stage cannot change extension sources in the same PR. Follow [ADR 0056](../../adrs/0056-project-resource-anchors.md).

## Non-goals

Cross-project links, public sharing, content access grants, domain record registries, ticket dependency replacement, graph views, new roles, activity feeds and notifications.

## Mission test

Linking helps people reuse tool outputs. Most extensions need shared link persistence and scope. People get searchable controls; agents get the same operations. Stable identities preserve extension ownership and remote execution.
