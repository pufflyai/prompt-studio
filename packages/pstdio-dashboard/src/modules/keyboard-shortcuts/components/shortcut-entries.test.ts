import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { buildShortcutEntries, readShortcutSources } from "./shortcut-entries";

describe("buildShortcutEntries", () => {
  test("lists registered shortcuts even when their context is inactive", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand({ id: "active", label: "Active" }, { execute: () => undefined });
    workbench.commands.registerCommand({ id: "inactive", label: "Inactive" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: "active" }, keybinding: "Mod+A" });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "inactive" },
      keybinding: "Mod+I",
      when: "inputFocus",
    });

    const activeCommandIds = workbench.keybindings
      .listActiveKeybindings()
      .flatMap((binding) => (binding.action.kind === "command" ? [binding.action.commandId] : []));
    expect(activeCommandIds).toContain("active");
    expect(activeCommandIds).not.toContain("inactive");
    expect(buildShortcutEntries(readShortcutSources(workbench)).map((entry) => entry.label)).toEqual(
      expect.arrayContaining(["Active", "Inactive"]),
    );
  });
});

test("merges menu placements by command and parameters without exposing internal commands", () => {
  const workbench = createWorkbench();
  for (const id of ["route", "menu-one", "menu-two", "options"]) {
    workbench.commands.registerCommand({ id, label: id }, { execute() {} });
  }
  workbench.layout.registerMenuItem(["palette"], {
    commandId: "menu-one",
    sourceCommandId: "route",
    label: "Open first",
    args: { a: 1, b: 2 },
  });
  workbench.layout.registerMenuItem(["toolbar"], {
    commandId: "menu-two",
    sourceCommandId: "route",
    label: "Open first",
    args: { b: 2, a: 1 },
  });
  workbench.layout.registerMenuItem(["palette"], {
    commandId: "route",
    label: "Open second",
    args: { a: 2 },
  });
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "route", args: { a: 1, b: 2 } },
    keybinding: ["Mod+K", "Mod+O"],
  });
  const entries = buildShortcutEntries(readShortcutSources(workbench)).filter((entry) =>
    entry.label.startsWith("Open "),
  );
  expect(entries.map((entry) => entry.label)).toEqual(["Open first", "Open second"]);
  expect(entries[0]?.keybindings).toEqual([["Mod+K", "Mod+O"]]);
  expect(entries[1]?.keybindings).toEqual([]);
});

test("lists all navigation bindings and retains an unassigned placement after disposal", () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, page: { kind: "page" as const, extensionId: "tools.notes", id: "notes" } };
  const panel = {
    kind: "panel" as const,
    panel: { kind: "placement" as const, extensionId: "tools.notes", id: "inspector" },
  };
  const href = { kind: "href" as const, href: "https://example.com/help" };
  const compound = { kind: "compound" as const, targets: [page, panel] };
  const placements = workbench.navigationTrees.registerContribution({
    id: "actions",
    getSections: () => [],
    owner: { kind: "mode", id: "tools", extensionId: "tools.notes" },
    sourceExtensionId: "tools.notes",
    declarationIndex: 0,
    listActions: () => [{ label: "Visit help", action: href }],
  });
  const bindings = [page, panel, href, compound].map((action, index) =>
    workbench.keybindings.registerKeybinding({ action, keybinding: `Alt+${index}`, when: "inputFocus" }),
  );
  const entries = buildShortcutEntries(readShortcutSources(workbench)).filter((entry) =>
    entry.category.includes("tools.notes"),
  );
  expect(entries).toHaveLength(4);
  expect(entries.find((entry) => entry.label === "Visit help")?.keybindings).toEqual(["Alt+2"]);
  expect(entries.find((entry) => entry.label.includes(" + "))?.label).toContain("inspector");
  expect(entries.every((entry) => entry.category.includes("tools.notes"))).toBe(true);
  for (const binding of bindings) binding.dispose();
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.category.includes("tools.notes")),
  ).toMatchObject([{ label: "Visit help", keybindings: [] }]);
  placements.dispose();
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.category.includes("tools.notes")),
  ).toEqual([]);
});

test("includes declared toolbar actions without exposing the view query command", () => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand({ id: "export", label: "Export" }, { execute() {} });
  workbench.commands.registerCommand({ id: "selected", label: "Export selected" }, { execute() {} });
  workbench.commands.registerCommand({ id: "query", label: "Fetch rows" }, { execute() {} });
  const view = workbench.views.registerView({
    id: "records",
    title: "Records",
    body: {
      kind: "dataTable",
      executeQuery: async () => ({ rows: [] }),
      rowActions: [{ id: "row", label: "Export row", commandId: "export", run() {} }],
      selectionActions: [{ id: "selection", label: "Export selected", commandId: "selected", run() {} }],
      toolbarActions: [{ id: "export", label: "Export records", commandId: "export", args: { format: "csv" } }],
    },
  });
  const entries = buildShortcutEntries(readShortcutSources(workbench));
  expect(entries.find((entry) => entry.label === "Export records")?.keybindings).toEqual([]);
  expect(entries.some((entry) => entry.label === "Fetch rows")).toBe(false);
  expect(entries.find((entry) => entry.label === "Export row")?.keybindings).toEqual([]);
  expect(entries.find((entry) => entry.label === "Export selected")?.keybindings).toEqual([]);
  view.dispose();
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.label.startsWith("Export")),
  ).toEqual([]);
});

test("merges empty command parameters with omitted parameters", () => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand({ id: "open", label: "Open records" }, { execute() {} });
  workbench.layout.registerMenuItem(["palette"], { commandId: "open", label: "Open records", args: {} });
  workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: "open" }, keybinding: "Alt+O" });
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.label === "Open records"),
  ).toMatchObject([{ label: "Open records", keybindings: ["Alt+O"] }]);
});

test("discovers declared Kanban row-menu actions until their view is disposed", async () => {
  const { registerWorkbenchExtensionKanbanRenderers } = await import("@pstdio/workbench/extensions");
  const workbench = createWorkbench();
  workbench.commands.registerCommand(
    { id: "tools.records.command.archive", label: "Archive record" },
    { execute() {} },
  );
  const registration = registerWorkbenchExtensionKanbanRenderers(
    { projectId: "project", workbench, executeCommand: async () => [] },
    [
      {
        id: "records",
        extensionId: "tools.records",
        title: "Records",
        queryHandlerId: "query",
        rowActions: [{ id: "archive", label: "Archive record", commandId: "tools.records.command.archive" }],
      },
    ],
  );
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.category === "tools.records"),
  ).toMatchObject([{ label: "Archive record", category: "tools.records", keybindings: [] }]);
  registration.dispose();
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.category === "tools.records"),
  ).toEqual([]);
});
