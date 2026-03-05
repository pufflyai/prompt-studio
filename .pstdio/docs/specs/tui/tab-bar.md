# TUI Spec: Tab Bar

The TUI replaces its single-mode layout with a tab bar. Tabs provide persistent top-level navigation between the three content areas.

## Layout

```
┌────────────────────────────────────────────────────┐
│  pstdio │ my-project                               │
│  ▸ Tickets │ Docs │ Templates                      │
│────────────────────────────────────────────────────│
│  (active tab content fills this area)              │
│────────────────────────────────────────────────────│
│  status bar                                        │
└────────────────────────────────────────────────────┘
```

The `▸` marker indicates the active tab.

## Tabs

| Position | Label     | Default | Spec                        |
| -------- | --------- | ------- | --------------------------- |
| 1        | Tickets   | yes     | [tickets](./tickets.md)     |
| 2        | Docs      |         | [docs](./docs.md)           |
| 3        | Templates |         | [templates](./templates.md) |

## Switching

| Key         | Action                      |
| ----------- | --------------------------- |
| `Tab`       | Next tab (wraps around)     |
| `Shift+Tab` | Previous tab (wraps around) |
| `1`         | Jump to Tickets             |
| `2`         | Jump to Docs                |
| `3`         | Jump to Templates           |

Tab switching preserves each tab's scroll position and selection state.

## Overlays

Project picker (`p`), agent manager (`a`), settings (`S`), and help (`?`) remain full-screen overlays rendered above the active tab. They are accessible from any tab.

## Mode Changes

The `Mode` type changes from:

```ts
type Mode = "normal" | "search" | "help" | "view" | "projects" | "agents";
```

to:

```ts
type Tab = "tickets" | "docs" | "templates";
type Overlay = "help" | "view" | "projects" | "agents" | "settings";
type Mode = { tab: Tab; overlay?: Overlay; search?: boolean };
```

This separates tab navigation from overlays and search state. The active tab persists when an overlay opens or closes.

## Component

| File                     | Description                              |
| ------------------------ | ---------------------------------------- |
| `components/tab-bar.tsx` | Renders tab labels with active indicator |

Props: `tabs: string[]`, `activeIndex: number`, `width: number`.

## Header

The header row shows `pstdio │ <project-name>` on the first line. The tab bar renders on the second line, replacing the old separator. A new separator line sits below the tab bar.

```
 pstdio │ my-project
 ▸ Tickets │ Docs │ Templates
─────────────────────────────
```

## Status Bar

Hint text updates per active tab. See each tab's spec for its hints.
