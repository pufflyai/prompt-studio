import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { buildShortcutEntries, readShortcutSources } from "./shortcut-entries";

describe("buildShortcutEntries", () => {
  test("groups host navigation under Dashboard", () => {
    const workbench = createWorkbench();
    workbench.keybindings.registerKeybinding({
      action: { kind: "page", page: { kind: "page", extensionId: "pstdio", id: "sessions" } },
      keybinding: "Alt+Shift+S",
    });
    expect(
      buildShortcutEntries(readShortcutSources(workbench)).find((entry) => entry.label === "sessions"),
    ).toMatchObject({ category: "Dashboard" });
  });
  test("groups assigned actions by the extension display name", () => {
    const workbench = createWorkbench();
    workbench.keybindings.registerKeybinding({
      sourceExtensionId: "pstdio.pstdio-notes",
      action: { kind: "page", page: { kind: "page", extensionId: "pstdio.pstdio-notes", id: "notes" } },
      keybinding: "Alt+Shift+N",
    });
    expect(
      buildShortcutEntries(
        readShortcutSources(workbench, [{ id: "pstdio.pstdio-notes", name: "pstdio-notes", displayName: "Notes" }]),
      ).find((entry) => entry.category === "Notes"),
    ).toMatchObject({ category: "Notes", keybindings: ["Alt+Shift+N"] });
  });
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
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "route", args: { a: 2 } },
    keybinding: "Alt+2",
  });
  const entries = buildShortcutEntries(readShortcutSources(workbench)).filter((entry) =>
    entry.label.startsWith("Open "),
  );
  expect(entries.map((entry) => entry.label)).toEqual(["Open first", "Open second"]);
  expect(entries[0]?.keybindings).toEqual([["Mod+K", "Mod+O"]]);
  expect(entries[1]?.keybindings).toEqual(["Alt+2"]);
});

test("lists all navigation bindings until disposal", () => {
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
  const entries = buildShortcutEntries(readShortcutSources(workbench)).filter(
    (entry) => entry.category === "Extensions",
  );
  expect(entries).toHaveLength(4);
  expect(entries.find((entry) => entry.label === "Visit help")?.keybindings).toEqual(["Alt+2"]);
  expect(entries.find((entry) => entry.label.includes(" + "))?.label).toContain("inspector");
  expect(entries.every((entry) => entry.category === "Extensions")).toBe(true);
  for (const binding of bindings) binding.dispose();
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.category === "Extensions"),
  ).toEqual([]);
  placements.dispose();
  expect(
    buildShortcutEntries(readShortcutSources(workbench)).filter((entry) => entry.category === "Extensions"),
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
