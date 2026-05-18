import { describe, expect, test } from "bun:test";
import { createWorkbenchThemeController } from "./theme-controller";

describe("createWorkbenchThemeController", () => {
  test("stores active workbench theme tokens", () => {
    const theme = createWorkbenchThemeController();

    theme.setTheme("dark");

    expect(theme.getTheme().id).toBe("dark");
    expect(theme.getTheme().tokens.activityBarBackground).toBe("var(--chakra-colors-bg-muted)");
    expect(theme.getCssVariables()["--workbench-activity-bar-bg"]).toBe("var(--chakra-colors-bg-muted)");
  });

  test("does not publish an update when setting the active theme again", () => {
    const theme = createWorkbenchThemeController();
    let updates = 0;
    theme.store.subscribe(() => {
      updates += 1;
    });

    theme.setTheme("light");

    expect(updates).toBe(0);
  });

  test("registers disposable themes", () => {
    const theme = createWorkbenchThemeController();
    const registration = theme.registerTheme({
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

    theme.setTheme("dynamic");

    expect(theme.listThemes().map((candidate) => candidate.id)).toContain("dynamic");
    expect(theme.getTheme().id).toBe("dynamic");

    registration.dispose();

    expect(theme.listThemes().map((candidate) => candidate.id)).not.toContain("dynamic");
    expect(theme.getTheme().id).toBe("light");
  });
});
