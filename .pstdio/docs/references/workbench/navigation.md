# pstdio-workbench Navigation

Navigation is workbench's ingress layer. URLs (deep links, command URIs, URI handlers) come in; typed `NavigationTarget`s come out; existing openers do the work. The workbench never tries to be a router — it converts a location into a sequence of actions a host (TanStack Router, the command palette, a tree node click) can dispatch.

## Mental Model

1. **Parsers** turn a location string into a `NavigationTarget`.
2. **The dispatcher** runs the target's items through existing workbench openers (`resources.openResource`, `layout.openWidget`, `commands.executeCommand`).
3. **Navigators** are the inverse: they turn a `ResourceRef` back into an `href` or perform a side-effecting navigation outside the workbench (typically routing).

Parsers and the dispatcher solve "given a URL, do the right thing." Navigators solve "given a resource, where does it live in the URL grammar of the host."

## NavigationTarget

```ts
type NavigationTarget =
  | { kind: "resource"; resource: ResourceRef; input?: OpenResourceInput }
  | { kind: "view"; widgetId: string; input?: OpenWidgetInput }
  | { kind: "command"; commandId: string; args?: unknown }
  | { kind: "compound"; targets: readonly NavigationTargetItem[] };
```

| Kind       | Dispatches to                                                |
| ---------- | ------------------------------------------------------------ |
| `resource` | `resources.openResource(resource, input)`                    |
| `view`     | `layout.openWidget(widgetId, input)` + reveal the host area  |
| `command`  | `commands.executeCommand(commandId, args)`                   |
| `compound` | Each item in order via the rules above                       |

`compound` exists because some URLs express more than one action — opening a ticket _and_ revealing the tree view it lives under, for example. Avoid using it for unrelated work; the host can call `navigate()` more than once.

A `view` target also makes the widget's area visible (`layout.setAreaVisible(area, true)`) and opens the collapsed-panel state (`panels.setOpen(area, true)`) — navigation is ingress driven by a user action, so opening into a hidden panel would be a dead click. Direct `layout.openWidget` calls outside the navigation dispatcher keep the silent semantics so module bootstrap can place widgets in an area that should stay hidden by default.

## Parsers

A parser declares whether it can handle a location and, if so, returns the target.

```ts
ctx.navigation.registerParser({
  id: "project-open",
  priority: 20,
  canParse: (location) => location.startsWith("pstdio://open"),
  parse: (location) => {
    const url = new URL(location);
    const ticketId = url.searchParams.get("resource")?.split(":")[1];
    const widgetId = url.searchParams.get("view") ?? "workspace-tree";
    if (!ticketId) return { kind: "view", widgetId };
    return {
      kind: "compound",
      targets: [
        {
          kind: "resource",
          resource: { kind: "ticket", uri: `ticket:${ticketId}`, id: ticketId },
        },
        { kind: "view", widgetId },
      ],
    };
  },
});
```

Parsers are evaluated in priority order, highest first; ties break by parser id. The first parser whose `canParse()` returns true wins. `resolveLocation()` throws when no parser matches.

Keep `canParse()` cheap — it's called for every parser on every location until one matches. Heavier validation belongs in `parse()`, which may throw to reject an otherwise-claimed location.

Modules typically register one parser per URL family they own. The dashboard registers one parser for `pstdio://` URIs and dispatches based on the URI path; extensions may register additional parsers for their own URL shapes.

## Dispatching

Three entry points, increasing in convenience:

```ts
// Pre-parsed target.
await workbench.navigation.openTarget(target);

// Parse + dispatch in one call.
await workbench.navigation.navigate(
  "pstdio://open?resource=ticket:PS-200&view=workspace-tree",
);

// Resolve only — useful when you want to inspect or rewrite the target before dispatch.
const target = workbench.navigation.resolveLocation(location);
```

`navigate()` is the shorthand most callers should use. Route loaders, command palette URL inputs, and URI handlers all go through it. Reach for `resolveLocation()` only when you need to inspect or rewrite the target before dispatch.

Both `openTarget()` and `navigate()` return `Promise<readonly unknown[]>`. The array preserves dispatch order; entries are whatever the underlying opener returned (typically the placement or the resource).

## Compound Atomicity

A compound target validates every item against the dispatcher's optional `can*` predicates _before_ any item runs. If any item is rejected, none of the items execute.

```ts
await workbench.navigation.openTarget({
  kind: "compound",
  targets: [
    { kind: "resource", resource: { kind: "ticket", uri: "ticket:PS-1" } },
    { kind: "view", widgetId: "missing-view" }, // canOpenWidget?(...) === false
  ],
});
// Rejects with "Cannot open navigation view target: missing-view".
// The resource open above never runs.
```

After pre-flight passes, items dispatch sequentially in order; later items see the side effects of earlier ones (`compound` is the right shape for "open the resource, then reveal the view that hosts it"). A dispatcher implementation may still throw mid-sequence — the spec only guarantees pre-flight validation, not that subsequent failures are rolled back.

When the dispatcher omits a `can*` predicate, the corresponding target kind is assumed dispatchable; pre-flight only rejects when the predicate explicitly returns `false`.

## Dispatcher Wiring

`createWorkbenchCore()` wires `resolveDispatcher` to its own `resources`, `layout`, and `commands`. Hosts almost never override this. Tests and headless usage can configure their own dispatcher:

```ts
import { createNavigationRegistry } from "pstdio-workbench/core";

const navigation = createNavigationRegistry({
  resolveDispatcher: () => ({
    openResource: async (resource) => visited.push(resource.uri),
    openWidget: (widgetId) => visited.push(`view:${widgetId}`),
    executeCommand: async (commandId) => visited.push(`cmd:${commandId}`),
    canOpenWidget: (widgetId) => widgetIds.has(widgetId),
  }),
});
```

`resolveDispatcher` is lazy so the navigation registry can be created before `resources` / `layout` / `commands` are ready. If `openTarget()` runs without a dispatcher configured, it throws `navigation.openTarget: no dispatcher available (configure resolveDispatcher)`.

## Navigators (the inverse direction)

A navigator turns a `ResourceRef` into an `href` and/or performs a navigation. The dashboard uses them to project workbench resources into TanStack Router URLs.

```ts
ctx.navigation.registerNavigator({
  id: "dashboard-router",
  priority: 10,
  canNavigate: (resource) => resource.kind === "project",
  createHref: (resource) => `/projects/${resource.id}/settings`,
  navigate: (resource) =>
    router.navigate({ to: `/projects/${resource.id}/settings` }),
});
```

`navigation.createHref(resource)` returns the href from the highest-priority navigator that both matches and exposes `createHref()`; `navigation.navigateResource(resource)` performs the navigation. These are independent of the parser/dispatcher path — they exist so workbench-internal links (a tree node, a breadcrumb) can become a real URL the host's router understands.

## Choosing Between APIs

| You have…                               | Use                                     |
| --------------------------------------- | --------------------------------------- |
| A URL the user clicked or pasted        | `navigation.navigate(location)`         |
| A pre-built `NavigationTarget`          | `navigation.openTarget(target)`         |
| A `ResourceRef` and want to act on it   | `resources.openResource(resource)`      |
| A `ResourceRef` and want an `href`      | `navigation.createHref(resource)`       |
| A `ResourceRef` and want to route to it | `navigation.navigateResource(resource)` |

A common rule of thumb: ingress (URL → action) goes through the parser+dispatcher; egress (resource → URL) goes through navigators.

## Errors

| Source              | Message                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `registerParser`    | `Navigation parser already registered: <id>`                                   |
| `registerNavigator` | `Resource navigator already registered: <id>`                                  |
| `resolveLocation`   | `No navigation parser registered for location: <location>`                     |
| `openTarget`        | `navigation.openTarget: no dispatcher available (configure resolveDispatcher)` |
| `openTarget`        | `Cannot open navigation resource target: <uri>`                                |
| `openTarget`        | `Cannot open navigation view target: <widgetId>`                               |
| `openTarget`        | `Cannot open navigation command target: <commandId>`                           |
| `createHref`        | `No navigator href registered for resource kind: <kind>`                       |
| `navigateResource`  | `No navigator registered for resource kind: <kind>`                            |

## See Also

- [API](./api.md) — full workbench surface.
- The Navigation example in `packages/pstdio-workbench/src/examples/navigation/` — exercises all four `NavigationTarget` variants from a Storybook story.
