import { expect, test } from "bun:test";
import { frameThemeOption, frameThemePreferences, frameThemes, resolveFrameTheme } from "./frame-themes";

const app = { id: "app-theme", mode: "dark" as const, tokens: { "colors.bg": "#000" } };

test("uses an authored theme until the frame owner chooses another", () => {
  expect(resolveFrameTheme(undefined, "vscode-flat-dark")).toBe("vscode-flat-dark");
  expect(resolveFrameTheme("pstdio-light", "vscode-flat-dark")).toBe("pstdio-light");
  expect(resolveFrameTheme("app", "vscode-flat-dark")).toBe("app");
  expect(resolveFrameTheme(undefined, undefined)).toBe("app");
});

test("sends the whole theme: the app's, a built-in one, or a project theme's id for the project to apply", () => {
  expect(frameThemeOption("app", app)).toBe(app);
  expect(frameThemeOption("prompt-contrast-dark", app)).toMatchObject({ mode: "dark", tokens: expect.any(Object) });
  expect(frameThemeOption("vscode-flat-dark", app)).toEqual({ id: "vscode-flat-dark", mode: "dark" });
});

test("offers built-in palettes and an authored project theme in the frame menu", () => {
  for (const mode of ["light", "dark"])
    expect(frameThemePreferences.find((theme) => theme.id === `prompt-contrast-${mode}`)).toMatchObject({ mode });
  expect(frameThemes("vscode-flat-dark").at(-1)).toEqual({ id: "vscode-flat-dark", title: "vscode-flat-dark" });
  expect(frameThemes("pstdio-dark").filter((theme) => theme.id === "pstdio-dark")).toHaveLength(1);
});
