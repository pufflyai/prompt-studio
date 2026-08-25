# Extension Modes

A mode is a named way of working in the dashboard workbench. An extension registers a mode and gives it placement recipes. A recipe says which resource kinds the mode accepts and where their panels go.

A panel declares its default placement for its extension's own resources or mode. Resource kinds declare slots for cross-extension contributions. A mode recipe only describes placement changes for one mode-resource context.

## Current Shape

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  modes: {
    ticket: {
      id: "planner.ticket",
      label: "Ticket",
      icon: "FileText",
      panelRegions: ["main", "secondary", "side"],
      resources: {
        ticket: {
          slots: {
            primary: { region: "main", required: true },
            navigation: { region: "sidenav", pinned: true },
            inspector: { region: "side", allowedRegions: ["side", "secondary"] },
          },
        },
      },
    },
  },
});
```

## Product Rules

- Mode identity comes from the contribution record. `label` is required and is the user-facing name. `icon` is optional.
- `resources` maps accepted resource kind ids to recipes. A bare kind id resolves inside the declaring extension; use `<extension>.<id>` for another extension's kind.
- A recipe's `slots` map places each slot of the resource kind into a docked region: `sidenav`, `main`, `secondary`, or `side`.
- A recipe's `panels` map changes one known panel's declared placement. The region must be in that panel placement's `allowedRegions`.
- Each placement can set:
  - `required`: the placement is structural. The host restores it whenever the mode-resource context activates, and the user cannot close it. On a slot, `required` is valid only when the slot's cardinality is `one`; in a cardinality-many slot, name a specific panel in the `panels` map instead.
  - `allowedRegions`: the regions the user may move the placement to. A mode cannot expand the panel's declared set.
  - `defaultOpen`: seed the panel open in a new layout; the user may close it.
  - `pinned`: keep the tab pinned.
- Exactly one main-region placement establishes the location for a primary resource.
- `modePanels` places mode-wide panels that do not consume the active resource. The same placement fields apply.
- `defaultResource` lets users enter the mode without a compatible resource. It is either a static resource ref (`{ type, id }`) or `{ commandId }` for a command that returns one.
- Existing valid user placements win over recipe defaults. Restoring a required placement does not reset optional placements or tab order.
- Closing an optional panel keeps it closed in the saved layout and offers it through the region's Add Panel control. Opening it there restores it in the region resolved by the mode recipe. Required panels are never offered because they cannot be closed.

## The Host Side Panel and Agents

`panelRegions` lists which host panel regions (`main`, `secondary`, `side`) the mode exposes. This is host chrome availability, not persisted layout.

The Side Panel is host chrome. It carries the Prompt Studio agents: session previews and new session drafts open there.

- Include `"side"` in `panelRegions` so the agents stay reachable while your mode is active.
- Omit `"side"` only when your mode replaces conversation UX entirely. Users then lose the agents until they leave the mode.
- Do not place your own panels in the `side` region to imitate the agents panel; contribute domain panels to `main`, `secondary`, or `sidenav`.

## Worked Example: A Ticket Screen

The resource owner declares the kind and puts its own panel placement beside each panel body. The mode only states differences. `resourcePanels` is reserved for panels contributed by another extension.

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  resourceKinds: {
    ticket: {
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        navigation: { cardinality: "many", external: true },
        inspector: { cardinality: "many", external: true },
      },
    },
  },
  panels: {
    ticketEditor: {
      title: "Ticket",
      show: {
        for: "ticket",
        region: "main",
        allowedRegions: ["main", "sidenav"],
        required: true,
      },
      webview: { entry: packageAsset("./src/ticket-editor.tsx", import.meta.url) },
    },
    ticketFiles: {
      title: "Files",
      show: {
        for: "ticket",
        region: "sidenav",
        allowedRegions: ["sidenav", "main"],
        required: true,
      },
      renderer: { kind: "tree", id: "ticketFilesTree" },
    },
  },
  modes: {
    ticket: {
      id: "planner.ticket",
      label: "Ticket",
      icon: "FileText",
      panelRegions: ["main", "secondary", "side"],
      defaultResource: { commandId: "tickets.defaultTicket" },
      resources: {
        ticket: {},
      },
    },
  },
});
```

Opening a ticket in this mode places the editor in `main` and pins the file tree in `sidenav`. A different mode can swap their placements because both declare `main` and `sidenav` in `allowedRegions`. The resulting primary-resource recipe must still have exactly one `main` placement. A mode cannot move a panel to an undeclared region.

Another extension can bind its panel to the open `inspector` slot with `resourcePanels`. The ticket mode can then place that slot in `side` or `secondary`.

## Relationship To UI Contributions

Use the shipped UI contribution surfaces for dashboard placement:

- `routes` for full webview-backed extension pages
- `treeItems` for area-tree entries that open routes, commands, panels, or resources
- `commands[].menus` for top action and command palette actions
- `statusItems` for status-surface chrome
- `settingsPanels` for project settings UI

Chrome contributions such as menus, activity items, and status items never appear in mode recipes. Use `when.mode` to limit their visibility to a specific active mode. A tree item without `when.mode` is not project-only. It stays available in built-in modes and extension-defined modes while the host left tree is present.
