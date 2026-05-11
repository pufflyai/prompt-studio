import { describe, expect, it } from "bun:test";
import { getPaletteEffectiveQuery, type PaletteMode, resolvePaletteMode } from "./palette-filter";

const modes: PaletteMode[] = [{ id: "search" }, { id: "command", inputPrefix: ">" }];

describe("palette query modes", () => {
  it("switches modes from the query prefix", () => {
    expect(resolvePaletteMode("theme", modes)).toBe("search");
    expect(resolvePaletteMode("> theme", modes)).toBe("command");
    expect(resolvePaletteMode("   > theme", modes)).toBe("command");
  });

  it("removes the mode prefix from the effective query", () => {
    expect(getPaletteEffectiveQuery("theme", modes, "search")).toBe("theme");
    expect(getPaletteEffectiveQuery("> theme", modes, "command")).toBe("theme");
    expect(getPaletteEffectiveQuery("   > theme", modes, "command")).toBe("theme");
  });
});
