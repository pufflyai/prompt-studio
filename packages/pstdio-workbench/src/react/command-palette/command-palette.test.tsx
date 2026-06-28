import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, workbenchCommandPaletteMenuPath } from "../../core";
import { createWorkbenchCommandPaletteEntries, createWorkbenchResourcePaletteEntries } from "./command-palette";
import { createWorkbenchModePaletteEntries, getModeEntryIndex } from "./mode-palette";
import { createWorkbenchThemePreferencePaletteEntries, getThemePreferenceEntryIndex } from "./theme-palette";

describe("createWorkbenchCommandPaletteEntries", () => {
  test("keeps command palette groups contiguous and orders actions inside each group", () => {
    const workbench = createWorkbenchCore();

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

  test("tags command palette entries with the command mode", () => {
    const workbench = createWorkbenchCore();
    workbench.commands.registerCommand(
      { id: "projects.show", label: "Show projects", category: "Projects" },
      { execute: () => undefined },
    );

    const entries = createWorkbenchCommandPaletteEntries({ workbench, onClose: () => undefined });

    expect(entries[0]?.mode).toBe("command");
  });

  test("includes command ids in palette search text", () => {
    const workbench = createWorkbenchCore();
    workbench.commands.registerCommand(
      { id: "extension-lab.demo.try-awaken", label: "Demo middleware rejection" },
      { execute: () => undefined },
    );

    const entries = createWorkbenchCommandPaletteEntries({ workbench, onClose: () => undefined });

    expect(entries[0]?.searchText).toContain("extension-lab.demo.try-awaken");
  });

  test("requests params instead of executing parameterized commands immediately", () => {
    const workbench = createWorkbenchCore();
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

    entries[0]?.onActivate();

    expect(requests).toEqual(["tickets.create"]);
    expect(executions).toBe(0);
  });

  test("does not create success notifications for command return values", async () => {
    const workbench = createWorkbenchCore();
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
      themePreference: "lab.monokai",
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
    expect(getThemePreferenceEntryIndex("missing", themePreferences)).toBe(0);
  });
});

describe("createWorkbenchModePaletteEntries", () => {
  test("builds selectable mode entries from registered workbench modes", () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "workspace", label: "Workspace", activate: () => undefined });
    workbench.modes.setActiveMode("project");

    let closed = false;
    const entries = createWorkbenchModePaletteEntries({ workbench, onClose: () => (closed = true) });

    expect(entries.map((entry) => ({ id: entry.id, mode: entry.mode, isSelected: entry.isSelected }))).toEqual([
      { id: "mode:project", mode: "mode", isSelected: true },
      { id: "mode:workspace", mode: "mode", isSelected: false },
    ]);

    entries.find((entry) => entry.modeId === "workspace")?.onActivate();

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(closed).toBe(true);
    expect(getModeEntryIndex("missing", workbench.modes.listModes())).toBe(0);
  });
});

describe("createWorkbenchResourcePaletteEntries", () => {
  test("flattens entries from every resource provider, tagged with the search mode", () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    workbench.resources.registerKind({ kind: "session", label: "Session" });

    workbench.resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [
        {
          resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1 Ship it" },
          group: "Tickets",
        },
      ],
    });
    workbench.resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: () => [
        {
          resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
          group: "Sessions",
        },
      ],
    });

    const entries = createWorkbenchResourcePaletteEntries({ workbench, query: "", onClose: () => undefined });

    expect(entries.map((entry) => ({ id: entry.id, mode: entry.mode, group: entry.group }))).toEqual([
      { id: "workbench-resource:pstdio://ticket/PS-1", mode: "search", group: "Tickets" },
      { id: "workbench-resource:pstdio://session/s1", mode: "search", group: "Sessions" },
    ]);
  });

  test("activating a resource entry opens the resource through the registry", async () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "ticket", label: "Ticket" });
    const opened: { uri: string; replaceActive: boolean | undefined }[] = [];
    workbench.resources.registerOpener({
      id: "tickets",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource, input) => {
        opened.push({ uri: resource.uri, replaceActive: input.replaceActive });
      },
    });
    workbench.resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [{ resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1" } }],
    });

    let closed = false;
    const entries = createWorkbenchResourcePaletteEntries({ workbench, query: "", onClose: () => (closed = true) });
    entries[0]?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(opened).toEqual([{ uri: "pstdio://ticket/PS-1", replaceActive: undefined }]);
    expect(closed).toBe(true);
  });

  test("activating a resource entry applies palette open input from the resource kind", async () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({
      kind: "workspace",
      label: "Workspace",
      paletteOpenInput: { replaceActive: true },
    });
    const opened: { uri: string; replaceActive: boolean | undefined }[] = [];
    workbench.resources.registerOpener({
      id: "workspaces",
      canOpen: (resource) => resource.kind === "workspace",
      open: (resource, input) => {
        opened.push({ uri: resource.uri, replaceActive: input.replaceActive });
      },
    });
    workbench.resources.registerProvider({
      id: "workspaces",
      kind: "workspace",
      list: () => [{ resource: { kind: "workspace", uri: "pstdio://workspace/PS-1", label: "PS-1" } }],
    });

    const entries = createWorkbenchResourcePaletteEntries({ workbench, query: "", onClose: () => undefined });
    entries[0]?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(opened).toEqual([{ uri: "pstdio://workspace/PS-1", replaceActive: true }]);
  });

  test("uses a browse entry activation override when present", async () => {
    const workbench = createWorkbenchCore();
    workbench.resources.registerKind({ kind: "session", label: "Session" });
    const activatedUris: string[] = [];

    workbench.resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: () => [
        {
          resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
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
