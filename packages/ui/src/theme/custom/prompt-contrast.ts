import { createMonacoTheme, createThemeTokens } from "pstdio-theme";

// Compare these palettes in the Prompt Contrast gallery and chat Canvas variants.
const palettes = {
  light: {
    bg: "#FFFFFF",
    "bg.subtle": "#EEF0F3",
    "bg.panel": "#FFFFFF",
    "bg.muted": "#E1E5EB",
    "bg.hover": "#D4DCE7",
    "bg.active": "#C1CEE0",
    "bg.elevated": "#EEF0F3",
    "bg.emphasized": "#C1CEE0",
    fg: "#111827",
    "fg.muted": "#364152",
    "fg.subtle": "#596575",
    border: "#596575",
    "border.subtle": "#596575",
    accent: "#0049A8",
    "accent.hover": "#00377D",
    "accent.pressed": "#00285C",
    "accent.fg": "#FFFFFF",
    focus: "#0049A8",
    info: "#0049A8",
    success: "#166534",
    warning: "#78350F",
    error: "#9F1239",
    "info.bg": "#E6F0FF",
    "success.bg": "#DCFCE7",
    "warning.bg": "#FEF3C7",
    "error.bg": "#FFE4E6",
  },
  dark: {
    bg: "#080C12",
    "bg.subtle": "#161E2B",
    "bg.panel": "#080C12",
    "bg.muted": "#233044",
    "bg.hover": "#33445C",
    "bg.active": "#405574",
    "bg.elevated": "#161E2B",
    "bg.emphasized": "#405574",
    fg: "#FFFFFF",
    "fg.muted": "#CBD5E1",
    "fg.subtle": "#9DAFC6",
    border: "#AABBD0",
    "border.subtle": "#AABBD0",
    accent: "#FFD84D",
    "accent.hover": "#FFE680",
    "accent.pressed": "#F5C62B",
    "accent.fg": "#111827",
    focus: "#8AC7FF",
    info: "#8AC7FF",
    success: "#86EFAC",
    warning: "#FDE68A",
    error: "#FDA4AF",
    "info.bg": "#102A44",
    "success.bg": "#102D20",
    "warning.bg": "#302408",
    "error.bg": "#37151D",
  },
};

export const promptContrastThemes = (["light", "dark"] as const).map((mode) => {
  const palette = palettes[mode];
  const roles: Record<string, string> = {};
  for (const role of [
    "bg",
    "bg.subtle",
    "bg.panel",
    "bg.muted",
    "bg.hover",
    "bg.active",
    "bg.elevated",
    "bg.emphasized",
    "fg",
    "fg.muted",
    "fg.subtle",
    "border",
    "border.subtle",
  ] as const)
    roles[role] = palette[role];
  Object.assign(roles, {
    "border.accent-light": palette.focus,
    "border.accent": palette.focus,
    "bg.accent-subtle": palette["bg.active"],
    "bg.button.primary.pressed": palette["accent.pressed"],
    "bg.accent-primary.pressed": palette["accent.pressed"],
    "fg.button.primary.hover": palette["accent.fg"],
    "fg.button.primary.pressed": palette["accent.fg"],
    "bg.menu-item.hover": palette["bg.hover"],
    "bg.menu-item.focus": palette["bg.hover"],
    "bg.menu-item.selected": palette["bg.active"],
    "fg.menu-item.hover": palette.fg,
    "fg.menu-item.focus": palette.fg,
    "fg.menu-item.selected": palette.fg,
  });
  for (const tone of ["info", "success", "warning", "error"] as const) {
    roles[`fg.${tone}`] = palette[tone];
    roles[`border.${tone}`] = palette[tone];
    roles[`bg.${tone}`] = palette[`${tone}.bg`];
  }
  const theme = {
    colors: {
      "editor.background": palette.bg,
      "editor.foreground": palette.fg,
      "editorWidget.background": palette["bg.panel"],
      "sideBar.background": palette["bg.subtle"],
      "editor.selectionBackground": palette["bg.active"],
      "editor.selectionForeground": palette.fg,
      "button.background": palette.accent,
      "button.hoverBackground": palette["accent.hover"],
      "button.foreground": palette["accent.fg"],
      descriptionForeground: palette["fg.muted"],
      disabledForeground: palette["fg.subtle"],
      focusBorder: palette.focus,
      "input.border": palette.border,
      "terminal.background": palette.bg,
      "terminal.foreground": palette.fg,
    },
    pstdio: { colors: roles },
  };
  return {
    id: `prompt-contrast-${mode}`,
    title: mode === "light" ? "Prompt Contrast Light" : "Prompt Contrast Dark",
    mode,
    tokens: createThemeTokens(mode, theme),
    monacoTheme: createMonacoTheme(mode, theme),
  };
});
