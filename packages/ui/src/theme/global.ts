export const globalCss = {
  "@property --split-size": { syntax: '"<length>"', inherits: "true", initialValue: "0px" },
  "@keyframes text-chunk": { from: { opacity: 0 }, to: { opacity: 1 } },
  "*::selection": {
    bg: {
      base: "bg.accent-secondary.blue-medium",
      _dark: "bg.accent-secondary.blue-medium",
    },
    color: {
      _dark: "fg.inverted",
    },
  },

  ":root": {
    "--focus-border": "border.accent-light",
    "--separator-border": "transparent !important",
  },

  ":root:has([data-window-title-bar])": {
    // Portalled toasts must clear the native window's draggable title bar.
    "--pstdio-toast-top-offset": "calc({sizes.window-title-bar} + {spacing.md})",
  },

  html: {
    height: "100%",
    width: "100%",
    overflow: "hidden",
  },

  hr: {
    borderColor: "border.subtle",
  },

  body: {
    height: "100%",
    width: "100%",
    fontFamily: "body",
    fontWeight: "regular",
    fontSize: "md",
    bg: "bg",
    color: "fg",
    borderColor: "border",
    overflow: "hidden",
  },

  "#root": {
    height: "100%",
    width: "100%",
    display: "flex",
  },

  ".sash": {
    zIndex: "docked",
  },

  "@keyframes message-fade-in": {
    from: { opacity: 0, transform: "translateY(4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },

  "@media (min-width: 2560px)": {
    html: { fontSize: "1.25rem" },
  },

  "@media (min-width: 3840px)": {
    html: { fontSize: "1.5rem" },
  },
};
