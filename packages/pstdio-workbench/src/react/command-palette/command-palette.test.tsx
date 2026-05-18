import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, workbenchCommandPaletteMenuPath } from "../../core";
import {
  createWorkbenchCommandPaletteEntries,
  createWorkbenchResourcePaletteEntries,
  createWorkbenchThemePaletteEntries,
} from "./command-palette";

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

    const favoritesEntries = entries.filter((entry) => entry.group === "Favorites");
    const contributedEntries = entries.filter((entry) => entry.group !== "Workbench" && entry.group !== "Favorites");

    expect(favoritesEntries.map((entry) => entry.label)).toEqual([
      "Toggle Current Favorite",
      "Add Current Resource to Favorites",
      "Remove Current Resource from Favorites",
      "Clear Missing Favorites",
    ]);

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

describe("createWorkbenchThemePaletteEntries", () => {
  test("builds theme entries from registered workbench themes", () => {
    const workbench = createWorkbenchCore();
    workbench.theme.registerTheme({
      id: "dynamic",
      tokens: {
        activityBarBackground: "#111827",
        sideBarBackground: "#102a2a",
        mainBackground: "#18181b",
        panelBackground: "#1f2937",
        statusBarBackground: "#0f172a",
        focusBorder: "#facc15",
        commandPaletteBackground: "#18181b",
      },
    });
    workbench.theme.setTheme("dynamic");

    let closed = false;
    const entries = createWorkbenchThemePaletteEntries({ workbench, onClose: () => (closed = true) });

    expect(entries.map((entry) => ({ id: entry.id, mode: entry.mode, isSelected: entry.isSelected }))).toContainEqual({
      id: "workbench-theme:dynamic",
      mode: "theme",
      isSelected: true,
    });

    entries.find((entry) => entry.themeId === "light")?.onActivate();

    expect(workbench.theme.getTheme().id).toBe("light");
    expect(closed).toBe(true);
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
