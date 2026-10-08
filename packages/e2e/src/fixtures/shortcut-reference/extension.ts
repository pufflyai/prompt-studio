import {
  defineCommand,
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  definePage,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const command = defineCommand({
  id: "greet",
  title: "Shortcut greeting",
  palette: [{}],
  run() {
    return "Hello";
  },
});
const unassigned = defineCommand({ id: "unassigned", title: "Unassigned greeting", palette: [{}], run() {} });
const view = defineView({
  id: "reference",
  title: "Shortcut reference page",
  body: { kind: "dataTable", columns: [], query: () => ({ rows: [] }) },
});
const inspector = defineView({
  id: "inspector",
  title: "Shortcut inspector",
  body: { kind: "dataTable", columns: [], query: () => ({ rows: [] }) },
});
const page = definePage({
  id: "reference",
  title: "Shortcut reference page",
  path: "reference",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [{ id: "inspector", region: "side", item: { kind: "view", view: inspector.ref, presence: "closed" } }],
});
export default defineExtension({
  commands: [command, unassigned],
  views: [view, inspector],
  pages: [page],
  navigationItems: [
    defineNavigationItem({
      id: "reference",
      label: "Open shortcut destination",
      owner: workbenchModes.project,
      action: { kind: "page", page: page.ref },
    }),
  ],
  keybindings: [
    defineKeybinding({
      id: "greet",
      key: "alt+shift+g",
      action: { kind: "command", target: { command: command.ref } },
    }),
    defineKeybinding({ id: "page", key: "alt+shift+j", action: { kind: "page", page: page.ref } }),
    defineKeybinding({ id: "panel", key: "alt+shift+i", action: { kind: "panel", panel: page.panels.inspector! } }),
    defineKeybinding({
      id: "compound",
      key: "alt+shift+b",
      action: {
        kind: "compound",
        targets: [
          { kind: "page", page: page.ref },
          { kind: "panel", panel: page.panels.inspector! },
        ],
      },
    }),
    defineKeybinding({
      id: "href",
      key: "alt+shift+l",
      action: { kind: "href", href: "https://example.com/shortcuts" },
    }),
  ],
});
