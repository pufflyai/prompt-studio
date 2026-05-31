import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, workbenchCommandPaletteMenuPath } from "../../core";
import { createWorkbenchCommandPaletteEntries, createWorkbenchResourcePaletteEntries } from "./command-palette";
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
    const openedUris: string[] = [];
    workbench.resources.registerOpener({
      id: "tickets",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource) => {
        openedUris.push(resource.uri);
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

    expect(openedUris).toEqual(["pstdio://ticket/PS-1"]);
    expect(closed).toBe(true);
  });
});
