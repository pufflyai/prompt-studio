import { describe, expect, it } from "bun:test";
import { createShellCore } from "pstdio-shell/core";
import { createDashboardProjectShell, DASHBOARD_CHANGE_THEME_KEYBINDING } from "@/shared/shell/dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "@/shared/shell/menu-locations";
import {
  buildCommandPaletteEntries,
  DEFAULT_COMMAND_PALETTE_ASSET_LIMIT,
  filterCommandPaletteEntries,
  resolveCommandPaletteEscapeAction,
  resolveCommandPaletteMode,
} from "./command-palette";

const tickets = [
  { shorthand: "PS-1", title: "Add ticket search" },
  { shorthand: "PS-2", title: "Theme command palette" },
];

const sessions = [
  { id: "session-1", title: "Debug webhook delivery" },
  { id: "session-2", title: "Implement sidebar search" },
];

describe("command palette entries", () => {
  it("uses search mode until the query starts with a command marker", () => {
    expect(resolveCommandPaletteMode("theme")).toBe("search");
    expect(resolveCommandPaletteMode("> theme")).toBe("command");
    expect(resolveCommandPaletteMode("   > theme")).toBe("command");
  });

  it("filters searchable project entries and tickets outside command mode", () => {
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
      sessions,
      currentTheme: "pstdio-dark",
      run: () => {},
    });

    expect(filterCommandPaletteEntries(entries, "PS-2").map((entry) => entry.id)).toEqual(["ticket:PS-2"]);
  });

  it("filters project sessions outside command mode", () => {
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
      sessions,
      currentTheme: "pstdio-dark",
      run: () => {},
    });

    const [entry] = filterCommandPaletteEntries(entries, "webhook");

    expect(entry.id).toBe("session:session-1");
    expect(entry.action).toEqual({
      id: "navigate",
      type: "navigate",
      path: "/projects/project-1/sessions/session-1",
    });
  });

  it("filters commands after the command marker", () => {
    const shell = createDashboardProjectShell({ projectId: "project-1", navigate: () => undefined });
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
      sessions,
      currentTheme: "pstdio-dark",
      shell,
      run: () => {},
    });

    const [entry] = filterCommandPaletteEntries(entries, "> theme");

    expect(entry.id).toBe("command:change-theme");
    expect(entry.shortcut).toBe(DASHBOARD_CHANGE_THEME_KEYBINDING);
    shell.dispose();
  });

  it("filters themes inside the theme menu", () => {
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
      sessions,
      currentTheme: "pstdio-dark",
      run: () => {},
    });

    expect(filterCommandPaletteEntries(entries, "dark", "theme").map((entry) => entry.id)).toEqual([
      "theme:pstdio-dark",
    ]);
    expect(
      filterCommandPaletteEntries(entries, "", "theme").find((entry) => entry.id === "theme:pstdio-dark")?.isSelected,
    ).toBe(true);
  });

  it("builds theme entries from runtime theme preferences", () => {
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
      sessions,
      currentTheme: "solarized-dark",
      themePreferences: [{ id: "solarized-dark", mode: "dark" }],
      run: () => {},
    });

    expect(filterCommandPaletteEntries(entries, "", "theme").map((entry) => entry.id)).toEqual([
      "theme:solarized-dark",
    ]);
    expect(
      filterCommandPaletteEntries(entries, "", "theme").find((entry) => entry.id === "theme:solarized-dark")
        ?.isSelected,
    ).toBe(true);
  });

  it("uses runtime theme titles for theme labels", () => {
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
      sessions,
      currentTheme: "lab.monokai",
      themePreferences: [{ id: "lab.monokai", title: "Monokai", mode: "dark" }],
      run: () => {},
    });

    expect(filterCommandPaletteEntries(entries, "", "theme")[0]?.label).toBe("Monokai");
  });

  it("clears content on Escape before closing an empty palette", () => {
    expect(resolveCommandPaletteEscapeAction("theme")).toBe("clear");
    expect(resolveCommandPaletteEscapeAction("> theme")).toBe("clear");
    expect(resolveCommandPaletteEscapeAction("")).toBe("close");
  });

  it("exits the theme menu on Escape when the theme query is empty", () => {
    expect(resolveCommandPaletteEscapeAction("mono", "theme")).toBe("exit-view");
    expect(resolveCommandPaletteEscapeAction("", "theme")).toBe("exit-view");
  });
});

describe("command palette shell entries", () => {
  it("groups extension commands by extension display name and only includes commands slotted into project.commandPanel", () => {
    const shell = createShellCore();
    shell.registerModule({
      id: "extension.pstdio.extension-lab",
      ownerId: "pstdio.extension-lab",
      source: "extension",
      activate(ctx) {
        ctx.commands.registerCommand(
          { id: "lab.say-hello", label: "Say hello", category: "Extension Lab" },
          { execute: () => undefined },
        );
        ctx.commands.registerCommand(
          { id: "lab.heartbeat", label: "Lab heartbeat", category: "Extension Lab" },
          { execute: () => undefined },
        );
        ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
          commandId: "lab.say-hello",
          label: "Say hello",
        });
      },
    });
    shell.registerModule({
      id: "extension.pstdio.repo-health",
      ownerId: "pstdio.repo-health",
      source: "extension",
      activate(ctx) {
        ctx.commands.registerCommand(
          { id: "repo-health.scan", label: "Run health scan", category: "Repo Health" },
          { execute: () => undefined },
        );
        ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
          commandId: "repo-health.scan",
          label: "Run health scan",
        });
      },
    });

    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      shell,
      run: () => {},
    });

    const commandEntries = filterCommandPaletteEntries(entries, ">");

    expect(commandEntries.find((entry) => entry.id === "extension:lab.heartbeat")).toBeUndefined();

    const labEntry = commandEntries.find((entry) => entry.id === "extension:lab.say-hello");
    const healthEntry = commandEntries.find((entry) => entry.id === "extension:repo-health.scan");

    expect(labEntry?.group).toBe("Extension Lab");
    expect(healthEntry?.group).toBe("Repo Health");
  });

  it("does not surface extension commands without a project.commandPanel menu contribution", () => {
    const shell = createShellCore();
    shell.registerModule({
      id: "extension.pstdio.extension-lab",
      ownerId: "pstdio.extension-lab",
      source: "extension",
      activate(ctx) {
        ctx.commands.registerCommand({ id: "lab.say-hello", label: "Say hello" }, { execute: () => undefined });
      },
    });

    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      shell,
      run: () => {},
    });

    const commandEntries = filterCommandPaletteEntries(entries, ">");
    expect(commandEntries.find((entry) => entry.id === "extension:lab.say-hello")).toBeUndefined();
  });

  it("emits a shell-command action for extension commands registered through the shell", () => {
    const shell = createShellCore();
    shell.registerModule({
      id: "extension.pstdio.extension-lab",
      ownerId: "pstdio.extension-lab",
      source: "extension",
      activate(ctx) {
        ctx.commands.registerCommand({ id: "lab.say-hello", label: "Say hello" }, { execute: () => undefined });
        ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
          commandId: "lab.say-hello",
          label: "Say hello",
          args: { slotId: "project.commandPanel" },
        });
      },
    });
    const seen: Array<{ args: unknown; commandId: string }> = [];
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      shell,
      run: (action) => {
        if (action.type === "shell-command") seen.push({ commandId: action.commandId, args: action.args });
      },
    });

    const target = entries.find((entry) => entry.id === "extension:lab.say-hello");
    target?.run();

    expect(seen).toEqual([{ commandId: "lab.say-hello", args: { slotId: "project.commandPanel" } }]);
  });

  it("surfaces command-palette menu commands registered through the shell", () => {
    const shell = createShellCore();
    const seen: Array<{ commandId: string; args: unknown }> = [];

    shell.commands.registerCommand(
      { id: "project.openSettings", label: "Open project settings", category: "Project", icon: "settings" },
      { execute: () => undefined },
      { source: "module", ownerId: "dashboard.project" },
    );
    shell.menus.registerMenuAction(
      DASHBOARD_COMMAND_PALETTE_MENU,
      { commandId: "project.openSettings", label: "Project settings", args: { projectId: "project-1" } },
      { source: "module", ownerId: "dashboard.project" },
    );

    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      shell,
      run: (action) => {
        if (action.type === "shell-command") seen.push({ commandId: action.commandId, args: action.args });
      },
    });

    const [entry] = filterCommandPaletteEntries(entries, "> settings");
    entry?.run();

    expect(entry?.id).toBe("shell:project.openSettings");
    expect(entry?.group).toBe("Project");
    expect(entry?.action).toEqual({
      id: "shell:project.openSettings",
      type: "shell-command",
      commandId: "project.openSettings",
      args: { projectId: "project-1" },
    });
    expect(seen).toEqual([{ commandId: "project.openSettings", args: { projectId: "project-1" } }]);
  });
});

describe("command palette default asset limits", () => {
  it("limits default ticket and session assets without hiding search results", () => {
    const ticketCount = DEFAULT_COMMAND_PALETTE_ASSET_LIMIT + 2;
    const sessionCount = DEFAULT_COMMAND_PALETTE_ASSET_LIMIT + 2;
    const manyTickets = Array.from({ length: ticketCount }, (_, index) => ({
      shorthand: `PS-${index + 1}`,
      title: index === ticketCount - 1 ? "Buried search result" : `Ticket ${index + 1}`,
    }));
    const manySessions = Array.from({ length: sessionCount }, (_, index) => ({
      id: `session-${index + 1}`,
      title: index === sessionCount - 1 ? "Buried session result" : `Session ${index + 1}`,
    }));
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: manyTickets,
      sessions: manySessions,
      currentTheme: "pstdio-dark",
      run: () => {},
    });

    const defaultEntries = filterCommandPaletteEntries(entries, "");

    expect(defaultEntries.filter((entry) => entry.id.startsWith("ticket:"))).toHaveLength(
      DEFAULT_COMMAND_PALETTE_ASSET_LIMIT,
    );
    expect(defaultEntries.filter((entry) => entry.id.startsWith("session:"))).toHaveLength(
      DEFAULT_COMMAND_PALETTE_ASSET_LIMIT,
    );
    expect(defaultEntries.some((entry) => entry.id === "nav:tickets")).toBe(true);
    expect(filterCommandPaletteEntries(entries, "Buried search result").map((entry) => entry.id)).toEqual([
      `ticket:PS-${ticketCount}`,
    ]);
    expect(filterCommandPaletteEntries(entries, "Buried session result").map((entry) => entry.id)).toEqual([
      `session:session-${sessionCount}`,
    ]);
  });

  it("limits default extension command assets without hiding command search results", () => {
    const shell = createShellCore();
    const commandCount = DEFAULT_COMMAND_PALETTE_ASSET_LIMIT + 2;
    shell.registerModule({
      id: "extension.pstdio.extension-lab",
      ownerId: "pstdio.extension-lab",
      source: "extension",
      activate(ctx) {
        for (let index = 0; index < commandCount; index += 1) {
          const commandId = `lab.command-${index + 1}`;
          const label = index === commandCount - 1 ? "Buried extension command" : `Lab command ${index + 1}`;
          ctx.commands.registerCommand(
            { id: commandId, label, category: "Extension Lab" },
            { execute: () => undefined },
          );
          ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, { commandId, label });
        }
      },
    });
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      shell,
      run: () => {},
    });

    const defaultCommands = filterCommandPaletteEntries(entries, ">");

    expect(defaultCommands.filter((entry) => entry.id.startsWith("extension:"))).toHaveLength(
      DEFAULT_COMMAND_PALETTE_ASSET_LIMIT,
    );
    expect(filterCommandPaletteEntries(entries, "> Buried extension command").map((entry) => entry.id)).toEqual([
      `extension:lab.command-${commandCount}`,
    ]);
  });
});
