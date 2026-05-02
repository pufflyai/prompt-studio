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
      currentTheme: "pstdio-dark",
      run: () => {},
    });

    expect(filterCommandPaletteEntries(entries, "PS-2").map((entry) => entry.id)).toEqual(["ticket:PS-2"]);
  });

  it("filters commands after the command marker", () => {
    const entries = buildCommandPaletteEntries({
      projectId: "project-1",
      tickets,
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
