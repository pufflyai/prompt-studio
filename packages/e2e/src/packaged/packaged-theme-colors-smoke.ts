import { expect } from "bun:test";

export const expectPackagedThemeColors = async (
  baseUrl: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/appearance`, { headers });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    themes: Array<{ id: string; tokens: Record<string, string>; monacoTheme: { colors: Record<string, string> } }>;
  };
  for (const id of ["solarized-light", "solarized-dark", "dracula", "monokai"]) {
    const theme = body.themes.find((theme) => theme.id.endsWith(`.${id}`));
    expect(theme).toBeDefined();
    const tokens = theme!.tokens;
    expect(tokens["colors.bg.button.primary.pressed"]).toMatch(/^#[0-9A-F]{6}$/i);
    expect(tokens["colors.bg.button.primary.pressed"]).not.toBe(tokens["colors.bg.button.primary.default"]);
    expect(tokens["colors.bg.button.primary.hover"]).not.toBe(tokens["colors.bg.button.primary.default"]);
    expect(tokens["colors.border.accent-light"]).toBe(tokens["colors.border.accent"]);
    expect(tokens["colors.border.subtle"]).not.toBe(tokens["colors.border"]);
    expect(tokens["colors.bg.subtle"]).not.toBe(tokens["colors.bg"]);
    expect(theme!.monacoTheme.colors).not.toHaveProperty("bg.button.primary.pressed");
    if (id.startsWith("solarized-")) {
      expect(tokens["colors.bg.tag"]).toBe(tokens["colors.bg.muted"]);
      if (id === "solarized-dark") {
        expect(theme!.monacoTheme.colors["editor.selectionBackground"]).not.toBe(tokens["colors.bg.active"]);
      }
      expect(tokens["colors.bg.active"]).toBe(tokens["colors.bg.menu-item.selected"]);
      for (const tone of ["info", "warning", "success", "error"]) {
        expect(tokens[`colors.fg.${tone}`]).toBe(tokens[`colors.border.${tone}`]);
      }
    }
  }
};
