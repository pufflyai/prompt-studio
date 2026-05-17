import { describe, expect, test } from "bun:test";
import { workbenchThemeCssVariableMap } from "../../core";
import { getWorkbenchAreaBackground, workbenchCommandPaletteBackground } from "./workbench-theme-background";

describe("workbench theme backgrounds", () => {
  test("maps workbench areas to theme background variables", () => {
    expect(getWorkbenchAreaBackground("activityBar")).toBe(
      `var(${workbenchThemeCssVariableMap.activityBarBackground}, var(--chakra-colors-bg-muted))`,
    );
    expect(getWorkbenchAreaBackground("left")).toBe(
      `var(${workbenchThemeCssVariableMap.sideBarBackground}, var(--chakra-colors-bg-subtle))`,
    );
    expect(getWorkbenchAreaBackground("main")).toBe(
      `var(${workbenchThemeCssVariableMap.mainBackground}, var(--chakra-colors-bg))`,
    );
    expect(getWorkbenchAreaBackground("main-bottom")).toBe(
      `var(${workbenchThemeCssVariableMap.panelBackground}, var(--chakra-colors-bg-panel))`,
    );
    expect(getWorkbenchAreaBackground("floating")).toBe(
      `var(${workbenchThemeCssVariableMap.panelBackground}, var(--chakra-colors-bg-panel))`,
    );
    expect(getWorkbenchAreaBackground("status")).toBe(
      `var(${workbenchThemeCssVariableMap.statusBarBackground}, var(--chakra-colors-bg-muted))`,
    );
    expect(workbenchCommandPaletteBackground).toBe(
      `var(${workbenchThemeCssVariableMap.commandPaletteBackground}, var(--chakra-colors-bg-panel))`,
    );
  });
});
