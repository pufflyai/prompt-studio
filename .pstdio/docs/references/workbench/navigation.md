# pstdio-workbench Navigation

Navigation only targets pages, commands, and hrefs. A resource is never a
destination: it travels as an argument on a page target, and the page's bindings
place it. The caller's choice of page is the choice of presentation.

The navigable location is `(page, resource?)`. The URL, the history stack, the
boot-time restore, and every host list of recent items store and replay that pair.
No host machinery ever holds a bare resource it must find a screen for.

## Navigation targets

The extension-facing union (`pstdio-api-contracts`, re-exported by
`@pstdio/sdk/extensions`):

```ts
type NavigationTarget =
  | {
      kind: "page";
      page: PageRef;
      resource?: ResourceRef; // fills the page's bound slots for the resource's kind
      slot?: string; // reveal: reopen this slot if closed and make its tab active
      open?: "preview" | "pin"; // `many` slots only; default "preview"
      section?: FileRendererSectionTarget; // deep-link into a file view
    }
  | { kind: "command"; target: CommandTarget }
  | { kind: "href"; href: string }
  | { kind: "compound"; targets: readonly NavigationTargetItem[] };
```

Targets appear in three declarative places: `NavigationItemContribution.action`,
`TreeNode.target`, and `CommandPaletteResourceItem.target`. The `onRowActivate`
callbacks on kanban and dataTable views may also return one (for example a page
target at another extension's page).

`preview` reuses the tab-retention machinery: the next preview replaces the
region's preview tab. `pin` inserts a persistent tab. In a one-cardinality slot the
intent is ignored; the slot swaps.

Examples:

```ts
// Open a page.
action: { kind: "page", page: ticketsPage.ref }

// Open a page with a resource argument, pinned.
return { navigate: { kind: "page", page: ticketsPage.ref, resource: ticketRef, open: "pin" } };

// Reveal a closed static slot.
return { navigate: { kind: "page", page: playground.ref, slot: "logs" } };
```

## In-page emissions

A view inside the active page emits a resource instead of naming a destination.
The active page's bindings place it; the bench holds still. If the page binds
nothing for that kind, the emission is a no-op with a host warning.

```ts
type ResourceEmission = {
  resource: ResourceRef;
  open?: "preview" | "pin"; // default "preview"
  section?: FileRendererSectionTarget; // re-target the matching open instance
};
```

An emission whose resource already has an open instance in the bound slot
re-activates that instance (applying `section` if given) instead of opening a
duplicate. Planner's document switching works this way: the file tree emits the
open ticket with a `section` target.

Emission sources:

- `onRowActivate` on kanban and dataTable views returning a `ResourceEmission`.
- A tree node or table row with a `resource` and no target: activation emits it.
- The webview `resource.open` capability: `{ resource, open? }` is an emission
  (`href` on the same capability opens an external link instead).

No renderer has a pin gesture. A single activation always emits a preview.
Pinning is host tab-strip behavior (double-click a preview tab or its pin
affordance), or `open: "pin"` on an explicit target.

## The page URL scheme

Extension pages are namespaced by extension id:

```txt
/projects/{project}/{extension-id}/{path}
```

`path` on the page contribution is the segment under that namespace, so
cross-extension collisions are unrepresentable. Host pages own the reserved
un-prefixed segments: `/projects/{project}/workspaces`,
`/projects/{project}/sessions`, and the bare `/projects/{project}` for start.
The active resource serializes after the page path.

The URL carries the page and the active bound instance only. Refresh restores that
pair; other pinned tabs are session state and are not restored. Page activations
and pinned opens push a browser history entry; preview swaps replace the current
one. Back and forward replay `(page, resource?)` locations.

Landing: when a project opens with nothing to restore, the host activates the
first project-navigation item whose action is a page target (or a compound target
containing one). When no such item exists, it lands on `workbenchPages.start`.

## Host pages for native screens

The host publishes page refs for its native screens as `workbenchPages.*`, next to
the `workbenchCommands.*` built-ins:

| Ref | Reserved segment | Binds |
| --- | --- | --- |
| `workbenchPages.workspaces` | `workspaces` | `workspace` |
| `workbenchPages.sessions` | `sessions` | `session`, `session-draft` |
| `workbenchPages.start` | the bare project URL | nothing |

An extension links a native screen the same way it links any page:

```ts
return { navigate: { kind: "page", page: workbenchPages.workspaces, resource: workspaceRef } };
```

Settings is not a host page. It stays an overlay opened by command.

## Mode switching

Switching modes is a plain command, not a navigation target kind:

```ts
action: {
  kind: "command",
  target: { command: workbenchCommands.switchMode, params: { modeId: labMode.id } },
}
```

`modeId` is the mode's local id. Use `when: { mode: labMode.ref }` for nav-item
active state.

## The workbench registry

Inside `@pstdio/workbench`, the same union appears with resolved string ids
(`navigation-registry.ts`):

```ts
type NavigationTarget =
  | ({ kind: "page"; pageId: string } & OpenWorkbenchPageInput)
  | { kind: "command"; commandId: string; args?: unknown }
  | { kind: "href"; href: string }
  | { kind: "compound"; targets: readonly NavigationTargetItem[] };
```

The registry converts locations into targets and dispatches them:

1. **Parsers** turn a location string into a `NavigationTarget`. Parsers are
   evaluated in priority order, highest first; the first whose `canParse()`
   returns true wins. `resolveLocation()` throws when no parser matches.
2. **The dispatcher** runs the target's items through the page controller
   (`openPage`), the command service (`executeCommand`), and `openHref`.
3. **Navigators** are the inverse: they turn a `ResourceRef` into an `href` or
   perform a host-router navigation.

Entry points:

```ts
await workbench.navigation.openTarget(target); // pre-parsed target
await workbench.navigation.navigate(location); // parse + dispatch
const target = workbench.navigation.resolveLocation(location); // resolve only
```

A compound target validates every item against the dispatcher's `can*` predicates
before any item runs; if one is rejected, none execute. Items then dispatch
sequentially, so later items see the effects of earlier ones. A dispatcher may
supply `createCheckpoint()`; a mid-sequence failure then rolls the layout back.

## Errors

| Source | Message |
| --- | --- |
| `registerParser` | `Navigation parser already registered: <id>` |
| `registerNavigator` | `Resource navigator already registered: <id>` |
| `resolveLocation` | `No navigation parser registered for location: <location>` |
| `openTarget` | `navigation.openTarget: no dispatcher available (configure resolveDispatcher)` |
| `openTarget` | `Cannot open navigation page target: <pageId>` |
| `openTarget` | `Cannot open navigation command target: <commandId>` |
| `openTarget` | `Cannot open navigation href target: <href>` |
| `createHref` | `No navigator href registered for resource kind: <kind>` |
| `navigateResource` | `No navigator registered for resource kind: <kind>` |

## See also

- [API](./api.md): the full workbench surface.
- [Choosing a UI surface](../../extensions/choosing-a-ui-surface.md): when a page,
  a mode, or a view-menu is the right destination to declare.
- [Navigation and layout state](../../extensions/navigation-and-layout-state.md):
  what persists across reloads and how to reset it.
