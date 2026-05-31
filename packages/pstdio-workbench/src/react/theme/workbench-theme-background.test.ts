import { describe, expect, test } from "bun:test";
import {
  getWorkbenchAreaBackground,
  workbenchCommandPaletteBackground,
  workbenchFocusBorder,
} from "./workbench-theme-background";

describe("workbench theme backgrounds", () => {
  test("maps workbench areas to theme background variables", () => {
    expect(getWorkbenchAreaBackground("activity")).toBe(
      "var(--chakra-colors-vscode-activityBar-background, var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-muted)))",
    );
    expect(getWorkbenchAreaBackground("left")).toBe(
      "var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-subtle))",
    );
    expect(getWorkbenchAreaBackground("main")).toBe(
      "var(--chakra-colors-vscode-editor-background, var(--chakra-colors-bg))",
    );
    expect(getWorkbenchAreaBackground("secondary")).toBe(
      "var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel))",
    );
    expect(getWorkbenchAreaBackground("floating")).toBe(
      "var(--chakra-colors-vscode-editorWidget-background, var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel)))",
    );
    expect(getWorkbenchAreaBackground("status")).toBe(
      "var(--chakra-colors-vscode-statusBar-background, var(--chakra-colors-vscode-activityBar-background, var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-muted))))",
    );
    expect(workbenchCommandPaletteBackground).toBe(
      "var(--chakra-colors-vscode-editorWidget-background, var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel)))",
    );
    expect(workbenchFocusBorder).toBe(
      "var(--chakra-colors-vscode-focusBorder, var(--chakra-colors-color-palette-focus-ring))",
    );
  });
});
