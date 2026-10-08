# Resource anchors

Resource anchors are directed links in one project. Endpoint identity is project ID, extension owner, local kind and resource ID. The host owner is `pstdio`. Labels, shorthands, icons and metadata are reference details. They do not change identity or grant content access.

## Public operations

`ctx.resources.addAnchors(resource, anchors)` adds a batch atomically. Repeating the same pair and details does nothing; changing its role or details updates the edge. Omitted role means `context`; other roles are `primary`, `source`, and `result`.

`ctx.resources.removeAnchors(resource, refs)` removes an atomic batch. Missing edges are no-ops. Owner validators receive the operation, canonical endpoints and role before an explicit change. They return `{ allowed: true }` or `{ allowed: false, reason }`. Declare the command with `defineResourceKind({ id, validateAnchors: command.ref })`. Validators must belong to the resource owner and cannot mutate links through their context.

`ctx.resources.listAnchors({ resource, direction?, role?, cursor?, limit? })` returns `{ items: [{ source, target }], nextCursor? }`. Default direction is `outgoing`; `incoming` and `both` read the same edges. The limit defaults to 50 and is between 1 and 100. Batches contain at most 100 refs. Queries use canonical endpoint ordering; cursors are opaque. Continue with the same resource, direction and role. Queries do not resolve content and keep working with unavailable refs.

Omitted projects use the current project. Host kinds infer `pstdio`. Inside extension contexts, declared kinds prefer the calling owner. Otherwise a single enabled declaration can supply the owner. Ambiguous kinds need explicit owners. Explicit foreign projects and host records belonging to another project are rejected.

Installed but disabled owners block explicit mutations. Uninstalled owners allow removal and reject addition. The host runs both owners' validators before writing any row. It never reads private owner storage to check whether extension endpoints exist.

## HTTP and client

The SDK client exposes `client.resources.addAnchors(projectId, resource, anchors)`, `removeAnchors(projectId, resource, refs)` and `listAnchors(projectId, input)`.

All three use authenticated POST routes under `/v1/projects/:projectId/resource-anchors`: `add` accepts `{ resource, anchors }`, `remove` accepts `{ resource, refs }`, and `query` accepts the SDK query shape.

## CLI

```sh
pst resources link --from '{"type":"item","id":"one","extensionId":"example.notes"}' --to '{"type":"item","id":"two","extensionId":"example.art"}' --role result
pst resources links --resource '{"type":"item","id":"two","extensionId":"example.art"}' --direction incoming
pst resources unlink --from '{"type":"item","id":"one","extensionId":"example.notes"}' --to '{"type":"item","id":"two","extensionId":"example.art"}'
```

The CLI uses the SDK client. `--project-id` defaults to the current project's configuration. Query output is JSON, including any next cursor.

## Storage and lifecycle

`resource_anchors` has one composite key for project and both endpoints. Its primary index supports outgoing queries; a reverse index supports incoming queries. Reference details and role are stored once. The migration backfills known workspace/session anchors and drops the old columns. Legacy `anchors_json` read fields are computed from indexed outgoing edges. Legacy methods remain during the ordered rollout.

After a real committed change the host publishes `resource_anchor_events` with `{ id, projectId, operation, items }`. Consumers refresh views for both source and target. Legacy workspace/session rows also refresh. Resource creation writes initial links in its transaction. Workspace deletion removes both directions in its transaction. Project deletion cascades. `ctx.resources.removed(ref)` cleans up links before publishing the committed removal fact and skips validators.

External storage cannot share a host transaction. A racing link can outlive deletion. Owners and views must treat unresolved endpoints as unavailable, keep the stored ref visible, and permit removal. Disabling an owner preserves its edges.

Shared dashboard controls and first-party extension adoption follow in separate PRs. See [ADR 0061](../../adrs/0061-project-resource-anchors.md) and the [PRD](../../requirements/platform/0006-resource-linking.md).
