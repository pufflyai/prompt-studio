import { describe, expect, test } from "bun:test";
import {
  getWorkbenchRegionBackground,
  workbenchCommandPaletteBackground,
  workbenchFocusBorder,
} from "./workbench-theme-background";

describe("workbench theme backgrounds", () => {
  test("maps workbench regions to theme background variables", () => {
    expect(getWorkbenchRegionBackground("activity")).toBe(
      "var(--chakra-colors-vscode-activityBar-background, var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-muted)))",
    );
    expect(getWorkbenchRegionBackground("sidenav")).toBe(
      "var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-subtle))",
    );
    expect(getWorkbenchRegionBackground("main")).toBe(
      "var(--chakra-colors-vscode-editor-background, var(--chakra-colors-bg))",
    );
    expect(getWorkbenchRegionBackground("secondary")).toBe(
      "var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel))",
    );
    expect(getWorkbenchRegionBackground("side")).toBe(
      "var(--chakra-colors-vscode-editorWidget-background, var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel)))",
    );
    expect(getWorkbenchRegionBackground("status")).toBe(
      "var(--chakra-colors-vscode-statusBar-background, var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-subtle)))",
    );
    expect(workbenchCommandPaletteBackground).toBe(
      "var(--chakra-colors-vscode-editorWidget-background, var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel)))",
    );
    expect(workbenchFocusBorder).toBe(
      "var(--chakra-colors-vscode-focusBorder, var(--chakra-colors-color-palette-focus-ring))",
    );
  });
});
