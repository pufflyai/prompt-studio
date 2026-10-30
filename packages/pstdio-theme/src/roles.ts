import { contrast, mix, opaque, readable } from "./color";
import type { ThemeMode, VsCodeColorTheme } from "./vscode";

/** Each role lists its source colors in precedence order. Component text stays local. */
const sources: Record<string, string[]> = {
  bg: ["editor.background"],
  fg: ["foreground", "editor.foreground"],
  "fg.muted": ["descriptionForeground"],
  "fg.subtle": ["disabledForeground"],
  "bg.code": ["editor.background"],
  "bg.panel": ["editorWidget.background", "panel.background", "sideBar.background"],
  "bg.subtle": ["sideBar.background"],
  "bg.hover": ["list.hoverBackground", "editor.lineHighlightBackground"],
  border: ["input.border", "border", "panel.border"],
  "border.subtle": ["border", "panel.border"],
  "border.accent": ["focusBorder"],
  "bg.menu-item.default": ["menu.background", "dropdown.background"],
  "fg.menu-item.default": ["menu.foreground", "foreground", "editor.foreground"],
  "bg.button.primary.default": ["button.background"],
  "bg.button.primary.hover": ["button.hoverBackground"],
  "fg.button.primary.default": ["button.foreground"],
  "bg.success": ["diffEditor.insertedTextBackground"],
  "bg.error": ["diffEditor.removedTextBackground"],
  "fg.success": ["gitDecoration.addedResourceForeground"],
  "fg.error": ["errorForeground", "gitDecoration.deletedResourceForeground"],
};

const menuStates = {
  hover: ["menu.selection", "list.hover"],
  focus: ["menu.selection", "list.focus", "list.hover"],
  selected: ["menu.selection", "list.activeSelection", "list.inactiveSelection"],
};

const mapRoles = (colors: Record<string, string>) => {
  const roles: Record<string, string> = {};
  for (const [role, candidates] of Object.entries(sources)) {
    const value = candidates.map((name) => colors[name]).find(Boolean);
    if (value) roles[role] = value;
  }
  for (const [state, candidates] of Object.entries(menuStates)) {
    const source = candidates.find((name) => colors[`${name}Background`]);
    if (!source) continue;
    roles[`bg.menu-item.${state}`] = colors[`${source}Background`];
    const foreground = colors[`${source}Foreground`];
    if (foreground) roles[`fg.menu-item.${state}`] = foreground;
  }
  return roles;
};

const createSurfaceResolver =
  (canvas: string, fg: string) =>
  (value: string | undefined, amount: number, backgrounds = [canvas]) => {
    const resolved = value ? opaque(value, canvas) : canvas;
    if (contrast(resolved, fg) >= 4.5 && backgrounds.every((background) => contrast(resolved, background) >= 1.08))
      return resolved;
    const opposite = contrast("#000000", fg) > contrast("#FFFFFF", fg) ? "#000000" : "#FFFFFF";
    for (const target of [fg, opposite]) {
      for (const ratio of [amount, amount + 0.08, amount + 0.16, amount + 0.24]) {
        const candidate = mix(canvas, target, ratio);
        if (
          contrast(candidate, fg) >= 4.5 &&
          backgrounds.every((background) => contrast(candidate, background) >= 1.08)
        )
          return candidate;
      }
    }
    return canvas;
  };

const resolvePalette = (mode: ThemeMode, roles: Record<string, string>) => {
  const canvas = opaque(roles.bg ?? (mode === "dark" ? "#07090E" : "#FFFFFF"), mode === "dark" ? "#07090E" : "#FFFFFF");
  const fg = readable(canvas, opaque(roles.fg ?? (mode === "dark" ? "#F7F8F8" : "#22252C"), canvas));
  const panelColor = opaque(roles["bg.panel"] ?? canvas, canvas);
  const panel = contrast(panelColor, fg) >= 4.5 ? panelColor : canvas;
  const accent = opaque(
    roles["bg.button.primary.default"] ?? roles["border.accent"] ?? (mode === "dark" ? "#A8CBFE" : "#0E6EF6"),
    canvas,
  );
  const buttonFg = readable(accent, roles["fg.button.primary.default"] ?? fg);
  const hover = roles["bg.button.primary.hover"] ?? mix(accent, buttonFg, 0.1);
  const pressed = roles["bg.button.primary.pressed"] ?? mix(accent, buttonFg, 0.2);
  const border = opaque(roles.border ?? mix(canvas, fg, 0.5), canvas);
  return { canvas, fg, panel, accent, buttonFg, hover, pressed, border };
};

export const createThemeTokens = (mode: ThemeMode, theme: VsCodeColorTheme) => {
  const colors = theme.colors ?? {};
  const roles = { ...mapRoles(colors), ...theme.pstdio?.colors };
  const { canvas, fg, panel, accent, buttonFg, hover, pressed, border } = resolvePalette(mode, roles);
  const menuBackground = opaque(roles["bg.menu-item.default"] ?? panel, canvas);
  const menuForeground = readable(menuBackground, roles["fg.menu-item.default"] ?? fg);
  const menuHover = createSurfaceResolver(menuBackground, menuForeground)(undefined, 0.16);
  const surface = createSurfaceResolver(canvas, fg);
  const defaults: Record<string, string> = {
    bg: canvas,
    fg,
    "fg.muted": readable(canvas, mix(canvas, fg, 0.7)),
    "fg.subtle": mix(canvas, fg, 0.6),
    "bg.subtle": surface(roles["bg.subtle"], 0.08),
    "bg.panel": panel,
    "bg.code": canvas,
    "bg.muted": surface(undefined, 0.12),
    "bg.hover": surface(roles["bg.hover"], 0.16, [canvas, panel]),
    "bg.active": surface(roles["bg.active"], 0.22),
    "bg.elevated": surface(undefined, 0.1),
    "bg.emphasized": surface(undefined, 0.22),
    "bg.inverted": fg,
    "fg.inverted": canvas,
    border,
    "border.subtle": mix(canvas, fg, 0.25),
    "border.inverted": border,
    "border.accent": roles["border.accent"] ?? accent,
    "border.accent-light": roles["border.accent"] ?? accent,
    "border.button.primary": accent,
    "bg.button.primary.default": accent,
    "bg.button.primary.hover": hover,
    "bg.button.primary.pressed": pressed,
    "fg.button.primary.default": buttonFg,
    "fg.button.primary.hover": readable(opaque(hover, canvas), buttonFg),
    "fg.button.primary.pressed": readable(opaque(pressed, canvas), buttonFg),
    "bg.accent-primary.default": accent,
    "bg.accent-primary.hover": hover,
    "bg.accent-primary.pressed": pressed,
    "bg.accent-primary.very-light": mix(canvas, accent, 0.12),
    "bg.accent-primary.light": accent,
    "bg.accent-primary.medium": hover,
    "bg.accent-primary.dark": pressed,
    "bg.accent-subtle": mix(canvas, accent, 0.18),
    "bg.accent-secondary.blue-medium": accent,
    "text.selectable.primary": readable(accent, fg),
    "text.selection": readable(opaque(theme.pstdio?.colors?.["bg.accent-secondary.blue-medium"] ?? accent, canvas), fg),
    "bg.menu-item.default": menuBackground,
    "fg.menu-item.default": menuForeground,
  };
  for (const [tone, fallback] of Object.entries(
    mode === "dark"
      ? { info: "#A8CBFE", warning: "#FDE68A", success: "#86EFAC", error: "#FDA4AF" }
      : { info: "#0049A8", warning: "#78350F", success: "#166534", error: "#9F1239" },
  )) {
    const toneFg = roles[`fg.${tone}`] ?? fallback;
    defaults[`fg.${tone}`] = toneFg;
    defaults[`bg.${tone}`] = mix(canvas, toneFg, 0.14);
    defaults[`border.${tone}`] = toneFg;
  }
  const resolved = { ...defaults, ...roles };
  Object.assign(resolved, {
    bg: canvas,
    fg,
    "bg.panel": panel,
    border,
    "bg.button.primary.default": accent,
    "fg.button.primary.default": buttonFg,
    "bg.menu-item.default": menuBackground,
    "fg.menu-item.default": menuForeground,
  });
  // Resolve imported surfaces over the canvas; explicit application roles remain authoritative.
  resolved["bg.subtle"] = defaults["bg.subtle"];
  resolved["bg.hover"] = defaults["bg.hover"];
  for (const state of ["hover", "focus", "selected"]) {
    const background = roles[`bg.menu-item.${state}`] ?? menuHover;
    resolved[`bg.menu-item.${state}`] = background;
    resolved[`fg.menu-item.${state}`] =
      roles[`fg.menu-item.${state}`] ?? readable(opaque(background, menuBackground), menuForeground);
  }
  Object.assign(resolved, theme.pstdio?.colors);
  const tokens: Record<string, string> = {};
  for (const [name, value] of Object.entries(colors)) tokens[`colors.vscode.${name}`] = value;
  for (const [role, value] of Object.entries(resolved)) tokens[`colors.${role}`] = value;
  return tokens;
};
