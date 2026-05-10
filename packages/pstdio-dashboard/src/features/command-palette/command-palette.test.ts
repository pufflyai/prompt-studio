import { describe, expect, it } from "bun:test";
import {
  buildCommandPaletteEntries,
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
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
      sessions,
      currentTheme: "pstdio-dark",
      run: () => {},
    });

    const [entry] = filterCommandPaletteEntries(entries, "> theme");

    expect(entry.id).toBe("command:change-theme");
    expect(entry.shortcut).toBe("Ctrl+Shift+K");
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

  it("groups extension commands by extension display name and only includes commands slotted into project.commandPanel", () => {
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      extensions: [
        { id: "pstdio.extension-lab", namespace: "lab", displayName: "Extension Lab", sourcePath: "" },
        { id: "pstdio.repo-health", namespace: "repo-health", displayName: "Repo Health", sourcePath: "" },
      ],
      extensionCommands: [
        { id: "lab.say-hello", extensionId: "pstdio.extension-lab", namespace: "lab", title: "Say hello" },
        { id: "lab.heartbeat", extensionId: "pstdio.extension-lab", namespace: "lab", title: "Lab heartbeat" },
        {
          id: "repo-health.scan",
          extensionId: "pstdio.repo-health",
          namespace: "repo-health",
          title: "Run health scan",
        },
      ],
      extensionMenuContributions: [
        {
          id: "lab.say-hello.menu.0",
          extensionId: "pstdio.extension-lab",
          commandId: "lab.say-hello",
          slotId: "project.commandPanel",
          label: "Say hello",
        },
        {
          id: "repo-health.scan.menu.0",
          extensionId: "pstdio.repo-health",
          commandId: "repo-health.scan",
          slotId: "project.commandPanel",
          label: "Run health scan",
        },
      ],
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
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      extensions: [{ id: "pstdio.extension-lab", namespace: "lab", displayName: "Extension Lab", sourcePath: "" }],
      extensionCommands: [
        { id: "lab.say-hello", extensionId: "pstdio.extension-lab", namespace: "lab", title: "Say hello" },
      ],
      run: () => {},
    });

    const commandEntries = filterCommandPaletteEntries(entries, ">");
    expect(commandEntries.find((entry) => entry.id === "extension:lab.say-hello")).toBeUndefined();
  });

  it("emits an extension-command action that targets the command id", () => {
    const seen: Array<{ commandId: string }> = [];
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets: [],
      sessions: [],
      currentTheme: "pstdio-dark",
      extensions: [{ id: "pstdio.extension-lab", namespace: "lab", displayName: "Extension Lab", sourcePath: "" }],
      extensionCommands: [
        { id: "lab.say-hello", extensionId: "pstdio.extension-lab", namespace: "lab", title: "Say hello" },
      ],
      extensionMenuContributions: [
        {
          id: "lab.say-hello.menu.0",
          extensionId: "pstdio.extension-lab",
          commandId: "lab.say-hello",
          slotId: "project.commandPanel",
          label: "Say hello",
        },
      ],
      run: (action) => {
        if (action.type === "extension-command") seen.push({ commandId: action.commandId });
      },
    });

    const target = entries.find((entry) => entry.id === "extension:lab.say-hello");
    target?.run();

    expect(seen).toEqual([{ commandId: "lab.say-hello" }]);
  });
});
