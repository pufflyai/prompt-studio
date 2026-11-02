import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbench, workbenchCommandPaletteMenuPath } from "../../core";
import { createWorkbenchCommandPaletteEntries, createWorkbenchResourcePaletteEntries } from "./command-palette";
import { createWorkbenchThemePreferencePaletteEntries, getThemePaletteEntryIndex } from "./theme-palette";

describe("createWorkbenchCommandPaletteEntries", () => {
  test.each([
    ["workbench.action.changeTheme", "theme", ""],
    ["workbench.action.showCommands", "main", "> "],
  ] as const)("keeps the palette opened by %s", async (commandId, view, initialQuery) => {
    const workbench = createWorkbench();
    workbench.commandPalette.open({ initialQuery: ">Change Theme" });
    const entry = createWorkbenchCommandPaletteEntries({
      workbench,
      onClose: () => workbench.commandPalette.close(),
    }).find((entry) => entry.commandId === commandId);

    expect(entry).toBeDefined();
    entry?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(workbench.commandPalette.isOpen()).toBe(true);
    expect(workbench.commandPalette.getView()).toBe(view);
    expect(workbench.commandPalette.getInitialQuery()).toBe(initialQuery);
  });

  test("closes the palette after a command succeeds without opening another picker", async () => {
    const workbench = createWorkbench();
    workbench.commandPalette.open();
    const entry = createWorkbenchCommandPaletteEntries({
      workbench,
      onClose: () => workbench.commandPalette.close(),
    }).find((entry) => entry.commandId === "workbench.toggleSideBar");

    entry?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(workbench.shell.getRegionState("sidenav").open).toBe(false);
    expect(workbench.commandPalette.isOpen()).toBe(false);
  });

  test("closes the original palette after a command confirmation succeeds", async () => {
    const workbench = createWorkbench();
    let confirmed = false;
    workbench.commands.registerCommand(
      { id: "sessions.archive", label: "Archive session" },
      {
        execute: async () => {
          confirmed = await workbench.commandPalette.requestConfirmation("Archive session");
        },
      },
    );
    workbench.commandPalette.open();
    const entry = createWorkbenchCommandPaletteEntries({
      workbench,
      onClose: () => workbench.commandPalette.close(),
    }).find((entry) => entry.commandId === "sessions.archive");

    entry?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const confirmation = workbench.commandPalette.store.getState().confirmation;
    expect(confirmation).not.toBeNull();
    confirmation?.resolve(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(confirmed).toBe(true);
    expect(workbench.commandPalette.isOpen()).toBe(false);
  });

  test("keeps a repeated request for the same command view open", async () => {
    const workbench = createWorkbench();
    workbench.commandPalette.open({ initialQuery: "> " });
    const entry = createWorkbenchCommandPaletteEntries({
      workbench,
      onClose: () => workbench.commandPalette.close(),
    }).find((entry) => entry.commandId === "workbench.action.showCommands");

    entry?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(workbench.commandPalette.isOpen()).toBe(true);
    expect(workbench.commandPalette.getInitialQuery()).toBe("> ");
  });

  test("keeps a failed command open with its inline error", async () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "files.open", label: "Open file" },
      {
        execute: () => {
          throw new Error("File unavailable");
        },
      },
    );
    workbench.commandPalette.open();
    const entry = createWorkbenchCommandPaletteEntries({
      workbench,
      onClose: () => workbench.commandPalette.close(),
    }).find((entry) => entry.commandId === "files.open");

    entry?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(workbench.commandPalette.isOpen()).toBe(true);
    expect(workbench.notifications.listNotifications()).toMatchObject([
      { inlineTarget: "command-palette", message: "File unavailable" },
    ]);
  });

  test("keeps command palette groups contiguous and orders actions inside each group", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "projects.show", label: "Show projects", category: "Projects" },
      { execute: () => undefined },
    );
    workbench.commands.registerCommand(
      { id: "sessions.open", label: "Open sessions", category: "Sessions" },
      { execute: () => undefined },
    );
    workbench.commands.registerCommand(
      { id: "projects.create", label: "Create project", category: "Projects" },
      { execute: () => undefined },
    );
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: "sessions.open",
      order: 10,
    });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: "projects.show",
      order: 10,
    });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: "projects.create",
      order: 11,
    });
    const entries = createWorkbenchCommandPaletteEntries({
      workbench,
      menuPath: workbenchCommandPaletteMenuPath,
      onClose: () => undefined,
    });
    const contributedEntries = entries.filter((entry) => entry.group !== "Workbench");
    expect(contributedEntries.map((entry) => ({ group: entry.group, label: entry.label }))).toEqual([
      { group: "Projects", label: "Show projects" },
      { group: "Projects", label: "Create project" },
      { group: "Sessions", label: "Open sessions" },
    ]);
  });
  test("shows an extension command shortcut on its palette placement", () => {
    const workbench = createWorkbench();
    for (const id of ["notes.create", "notes.palette.create"]) {
      workbench.commands.registerCommand({ id, label: "New note" }, { execute: () => undefined });
    }
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "notes.create" },
      keybinding: "Mod+Alt+N",
    });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: "notes.palette.create",
      sourceCommandId: "notes.create",
    });
    const [entry] = createWorkbenchCommandPaletteEntries({
      workbench,
      menuPath: workbenchCommandPaletteMenuPath,
      onClose: () => undefined,
    });
    expect(entry?.shortcut).toMatchObject({ props: { binding: "Mod+Alt+N" } });
  });
  test("matches shortcut arguments to the palette action", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand({ id: "notes.open", label: "Open note" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "notes.open", args: { noteId: "one" } },
      keybinding: "Alt+1",
    });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "notes.open", args: { noteId: "two" } },
      keybinding: "Alt+2",
    });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: "notes.open",
      args: { noteId: "one" },
    });
    const [entry] = createWorkbenchCommandPaletteEntries({
      workbench,
      menuPath: workbenchCommandPaletteMenuPath,
      onClose: () => undefined,
    });
    expect(entry?.shortcut).toMatchObject({ props: { binding: "Alt+1" } });
  });
  test("tags command palette entries with the command mode", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "projects.show", label: "Show projects", category: "Projects" },
      { execute: () => undefined },
    );
    const entries = createWorkbenchCommandPaletteEntries({ workbench, onClose: () => undefined });
    expect(entries[0]?.mode).toBe("command");
  });
  test("includes command ids in palette search text", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "extension-lab.demo.try-awaken", label: "Demo middleware rejection" },
      { execute: () => undefined },
    );
    const entries = createWorkbenchCommandPaletteEntries({ workbench, onClose: () => undefined });
    expect(entries.find((entry) => entry.commandId === "extension-lab.demo.try-awaken")?.searchText).toContain(
      "extension-lab.demo.try-awaken",
    );
  });
});
describe("command palette execution", () => {
  test.each([
    {},
    { title: "Meeting notes" },
  ])("executes palette actions with bound parameters %j immediately", async (args) => {
    const workbench = createWorkbench();
    const executions: unknown[] = [];
    const requests: string[] = [];
    workbench.commands.registerCommand(
      { id: "notes.create", label: "New note", params: { title: { type: "text" } } },
      { execute: (input) => executions.push(input) },
    );
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: "notes.create",
      args,
    });
    workbench.commandPalette.open();
    const entry = createWorkbenchCommandPaletteEntries({
      workbench,
      menuPath: workbenchCommandPaletteMenuPath,
      onClose: () => workbench.commandPalette.close(),
      onRequestParams: (request) => requests.push(request.record.command.id),
    }).find((entry) => entry.commandId === "notes.create");

    entry?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requests).toEqual([]);
    expect(executions).toEqual([args]);
    expect(workbench.commandPalette.isOpen()).toBe(false);
  });
  test("requests params instead of executing parameterized commands immediately", () => {
    const workbench = createWorkbench();
    let executions = 0;
    const requests: string[] = [];
    workbench.commands.registerCommand(
      {
        id: "tickets.create",
        label: "Create ticket",
        params: { title: { type: "text" } },
      },
      { execute: () => (executions += 1) },
    );
    const entries = createWorkbenchCommandPaletteEntries({
      workbench,
      onClose: () => undefined,
      onRequestParams: (request) => requests.push(request.record.command.id),
    });
    entries.find((entry) => entry.commandId === "tickets.create")?.onActivate();
    expect(requests).toEqual(["tickets.create"]);
    expect(executions).toBe(0);
  });
  test("does not create success notifications for command return values", async () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "extension-lab.counter.read", label: "Read lab counter" },
      { execute: () => ({ counter: 1 }) },
    );
    const entries = createWorkbenchCommandPaletteEntries({ workbench, onClose: () => undefined });
    entries[0]?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(workbench.notifications.listNotifications()).toEqual([]);
  });
});
describe("createWorkbenchThemePreferencePaletteEntries", () => {
  test("builds theme entries from UI theme preferences", () => {
    const selectedThemes: string[] = [];
    let closed = false;
    const themePreferences = [
      { id: "pstdio-light", mode: "light" },
      { id: "lab.monokai", title: "Monokai", mode: "dark" },
    ] as const;
    const entries = createWorkbenchThemePreferencePaletteEntries({
      chosenThemePreference: "lab.monokai",
      themePreferences,
      setThemePreference: (themePreference) => selectedThemes.push(themePreference),
      onClose: () => (closed = true),
    });
    expect(entries.map((entry) => ({ id: entry.id, mode: entry.mode, isSelected: entry.isSelected }))).toContainEqual({
      id: "theme:lab.monokai",
      mode: "theme",
      isSelected: true,
    });
    expect(entries.find((entry) => entry.themePreference === "lab.monokai")?.label).toBe("Monokai");
    entries.find((entry) => entry.themePreference === "pstdio-light")?.onActivate();
    expect(selectedThemes).toEqual(["pstdio-light"]);
    expect(closed).toBe(true);
    expect(getThemePaletteEntryIndex(entries, "missing")).toBe(0);
  });

  test("finds the chosen theme in the sorted picker order", () => {
    const entries = createWorkbenchThemePreferencePaletteEntries({
      chosenThemePreference: "pstdio-light",
      themePreferences: [
        { id: "pstdio-light", mode: "light" },
        { id: "pstdio-dark", mode: "dark" },
        { id: "lab.paper", title: "Paper", mode: "light" },
      ],
      setThemePreference: () => undefined,
      onClose: () => undefined,
    });

    expect(entries[getThemePaletteEntryIndex(entries, "pstdio-light")]?.themePreference).toBe("pstdio-light");
  });
});
describe("createWorkbenchResourcePaletteEntries", () => {
  test("flattens entries from every resource provider, tagged with the search mode", () => {
    const workbench = createWorkbench();
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.resources.registerKind({ kind: "session", label: "Session" });
    workbench.resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [
        {
          resource: {
            type: "ticket",
            label: "PS-1 Ship it",
            id: "pstdio://ticket/PS-1",
          },
          group: "Tickets",
          activate: () => undefined,
        },
      ],
    });
    workbench.resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: () => [
        {
          resource: {
            type: "session",
            label: "Session 1",
            id: "pstdio://session/s1",
          },
          group: "Sessions",
          activate: () => undefined,
        },
      ],
    });
    const entries = createWorkbenchResourcePaletteEntries({ workbench, query: "", onClose: () => undefined });
    expect(entries.map((entry) => ({ id: entry.id, mode: entry.mode, group: entry.group }))).toEqual([
      {
        id: `workbench-resource:${resourceKey({ type: "ticket", id: "pstdio://ticket/PS-1" })}`,
        mode: "search",
        group: "Tickets",
      },
      {
        id: `workbench-resource:${resourceKey({ type: "session", id: "pstdio://session/s1" })}`,
        mode: "search",
        group: "Sessions",
      },
    ]);
  });
  test("uses a browse entry activation override when present", async () => {
    const workbench = createWorkbench();
    workbench.resources.registerKind({ kind: "session", label: "Session" });
    const activatedUris: string[] = [];
    workbench.resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: () => [
        {
          resource: {
            type: "session",
            label: "Session 1",
            id: "pstdio://session/s1",
          },
          activate: () => activatedUris.push("pstdio://session/s1"),
        },
      ],
    });
    let closed = false;
    const entries = createWorkbenchResourcePaletteEntries({ workbench, query: "", onClose: () => (closed = true) });
    entries[0]?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(activatedUris).toEqual(["pstdio://session/s1"]);
    expect(closed).toBe(true);
  });
});
