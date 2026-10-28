import { describe, expect, test } from "bun:test";
import {
  getWorkbenchRegionBackground,
  workbenchCommandPaletteBackground,
  workbenchFocusBorder,
} from "./workbench-theme-background";

describe("workbench theme backgrounds", () => {
  test("maps workbench regions to theme background variables", () => {
    expect(getWorkbenchRegionBackground("activity")).toBe(
      "var(--chakra-colors-vscode-editor-background, var(--chakra-colors-bg))",
    );
    expect(getWorkbenchRegionBackground("sidenav")).toBe(
      "var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-subtle))",
    );
    expect(getWorkbenchRegionBackground("main")).toBe(
      "var(--chakra-colors-vscode-editor-background, var(--chakra-colors-bg))",
    );
    for (const region of [
      "main-header",
      "main-left-menu",
      "main-right-menu",
      "secondary",
      "secondary-header",
      "secondary-left-menu",
      "secondary-right-menu",
      "side",
      "side-header",
      "side-left-menu",
      "side-right-menu",
    ] as const) {
      expect(getWorkbenchRegionBackground(region)).toBe(getWorkbenchRegionBackground("main"));
    }
    expect(getWorkbenchRegionBackground("status")).toBe(
      "var(--chakra-colors-vscode-editor-background, var(--chakra-colors-bg))",
    );
    expect(workbenchCommandPaletteBackground).toBe(
      "var(--chakra-colors-vscode-editorWidget-background, var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel)))",
    );
    expect(workbenchFocusBorder).toBe(
      "var(--chakra-colors-vscode-focusBorder, var(--chakra-colors-color-palette-focus-ring))",
    );
  });
});
