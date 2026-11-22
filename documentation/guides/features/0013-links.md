# Links between tools

Connect a ticket to its pull request, or a report to its data, across tools.

## What links give you

A link connects two items in the same project, even when different tools own them. For example, a Planner ticket can link to the report or artifact that came out of it. Each tool keeps its own data. The link only records which items belong together.

A link has a direction, from one item to another, and a purpose:

- **context**: reference material. This is the default.
- **primary**, **source**, and **result**: stronger relationships. For example, Planner can use an item linked as a result as evidence that a ticket was implemented.

A link never gives access to the other item's content. If the tool that owns a linked item is disabled or removed, the link stays and shows the item as unavailable, so you can still remove it.

## Use links in Prompt Studio

Open an item and run **Related resources** from search (**Mod+P**). It lists the item's incoming and outgoing links. Choose **Link resource** to search your enabled tools for another item, pick a purpose, and add the link. Each link's menu offers **Open resource** and **Remove link**.

For example, choose **Link resource** on a ticket and pick the report that documents the work. Choose Context for reference or Result for implementation evidence.

From the terminal, run these inside the project folder. Each item is a `ResourceRef` JSON object with its `type`, `id`, and owning `extensionId`:

```sh
pst resources link --from '<ResourceRef JSON>' --to '<ResourceRef JSON>' --role result
pst resources links --resource '<ResourceRef JSON>' --direction both
pst resources unlink --from '<ResourceRef JSON>' --to '<ResourceRef JSON>'
```

`--role` accepts `primary`, `context`, `source`, or `result`. `links` returns JSON, including a cursor for the next page.

## Use links in your tool

A tool adds and removes links with `ctx.resources.addAnchors(resource, anchors)` and `ctx.resources.removeAnchors(resource, refs)`, and reads them with `ctx.resources.queryAnchors({ resource, direction, role, limit })`.

To make your items show up in **Related resources** with a current label and a link that opens them, declare a `resolveMany` command on your resource kind with `defineResourceKind`. It receives a batch of references and returns each one's current `resource` and navigation `target`. `validateAnchors` can refuse a link that does not make sense for your tool.

A view that lists linked items should refresh on `viewDataEvents.resourceAnchorsChanged` and `viewDataEvents.resourcesChanged`. External clients use `client.resources.addAnchors`, `removeAnchors`, and `queryAnchors` from `@pstdio/sdk/client`.

## Learn more

- [Related resources](../../references/sdk/0002-resources.md#related-resources) explains `resolveMany`, batching, and refresh events.
- [SDK client](../../references/sdk/0003-api.md) lists the `resources` client methods.
- [Navigation](0012-navigation.md) covers related items that open next to the one you are viewing.

*Updated at: 2026-11-22*
