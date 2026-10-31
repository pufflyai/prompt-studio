import { expect, test } from "bun:test";
import { frameThemePreferences, resolveFrameTheme } from "./frame-themes";

test("uses an authored theme until the frame owner chooses another", () => {
  expect(resolveFrameTheme(undefined, "vscode-flat-dark")).toBe("vscode-flat-dark");
  expect(resolveFrameTheme("pstdio-light", "vscode-flat-dark")).toBe("pstdio-light");
  expect(resolveFrameTheme("app", "vscode-flat-dark")).toBe("app");
  expect(resolveFrameTheme(undefined, "unknown")).toBe("app");
});

test("offers complete built-in contrast palettes for independent frames", () => {
  for (const mode of ["light", "dark"]) {
    expect(frameThemePreferences.find((theme) => theme.id === `prompt-contrast-${mode}`)).toMatchObject({
      mode,
      tokens: expect.any(Object),
    });
  }
});
