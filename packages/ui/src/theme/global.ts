export const globalCss = {
  "*::selection": {
    bg: {
      base: "bg.accent-secondary.blue-medium",
      _dark: "bg.accent-secondary.blue-medium",
    },
  },

  ":root": {
    "--focus-border": "blue.border",
    "--separator-border": "transparent !important",
  },

  html: {
    height: "100%",
    width: "100%",
    overflow: "hidden",
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
