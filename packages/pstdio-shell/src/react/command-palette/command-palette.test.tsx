import { describe, expect, test } from "bun:test";
import { createShellCore, workbenchCommandPaletteMenuPath } from "../../core";
import { createShellCommandPaletteEntries, createShellResourcePaletteEntries } from "./command-palette";

describe("createShellCommandPaletteEntries", () => {
  test("keeps command palette groups contiguous and orders actions inside each group", () => {
    const shell = createShellCore();

    shell.commands.registerCommand(
      { id: "projects.show", label: "Show projects", category: "Projects" },
      { execute: () => undefined },
    );
    shell.commands.registerCommand(
      { id: "sessions.open", label: "Open sessions", category: "Sessions" },
      { execute: () => undefined },
    );
    shell.commands.registerCommand(
      { id: "projects.create", label: "Create project", category: "Projects" },
      { execute: () => undefined },
    );

    shell.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: "sessions.open",
      order: 10,
    });
    shell.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: "projects.show",
      order: 10,
    });
    shell.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: "projects.create",
      order: 11,
    });

    const entries = createShellCommandPaletteEntries({
      shell,
      menuPath: workbenchCommandPaletteMenuPath,
      onClose: () => undefined,
    });

    expect(entries.map((entry) => ({ group: entry.group, label: entry.label }))).toEqual([
      { group: "Projects", label: "Show projects" },
      { group: "Projects", label: "Create project" },
      { group: "Sessions", label: "Open sessions" },
    ]);
  });

  test("tags command palette entries with the command mode", () => {
    const shell = createShellCore();
    shell.commands.registerCommand(
      { id: "projects.show", label: "Show projects", category: "Projects" },
      { execute: () => undefined },
    );

    const entries = createShellCommandPaletteEntries({ shell, onClose: () => undefined });

    expect(entries[0]?.mode).toBe("command");
  });
});

describe("createShellResourcePaletteEntries", () => {
  test("flattens entries from every resource provider, tagged with the search mode", () => {
    const shell = createShellCore();
    shell.resources.registerKind({ kind: "ticket", label: "Ticket" });
    shell.resources.registerKind({ kind: "session", label: "Session" });

    shell.resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [
        {
          resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1 Ship it" },
          group: "Tickets",
        },
      ],
    });
    shell.resources.registerProvider({
      id: "sessions",
      kind: "session",
      list: () => [
        {
          resource: { kind: "session", uri: "pstdio://session/s1", label: "Session 1" },
          group: "Sessions",
        },
      ],
    });

    const entries = createShellResourcePaletteEntries({ shell, query: "", onClose: () => undefined });

    expect(entries.map((entry) => ({ id: entry.id, mode: entry.mode, group: entry.group }))).toEqual([
      { id: "shell-resource:pstdio://ticket/PS-1", mode: "search", group: "Tickets" },
      { id: "shell-resource:pstdio://session/s1", mode: "search", group: "Sessions" },
    ]);
  });

  test("activating a resource entry opens the resource through the registry", async () => {
    const shell = createShellCore();
    shell.resources.registerKind({ kind: "ticket", label: "Ticket" });
    const openedUris: string[] = [];
    shell.resources.registerOpener({
      id: "tickets",
      canOpen: (resource) => resource.kind === "ticket",
      open: (resource) => {
        openedUris.push(resource.uri);
      },
    });
    shell.resources.registerProvider({
      id: "tickets",
      kind: "ticket",
      list: () => [{ resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", label: "PS-1" } }],
    });

    let closed = false;
    const entries = createShellResourcePaletteEntries({ shell, query: "", onClose: () => (closed = true) });
    entries[0]?.onActivate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openedUris).toEqual(["pstdio://ticket/PS-1"]);
    expect(closed).toBe(true);
  });
});
