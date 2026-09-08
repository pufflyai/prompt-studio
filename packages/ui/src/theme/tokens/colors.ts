import { vis } from "./colors-visualization";

export { vis } from "./colors-visualization";

import { bg } from "./colors-background";

export { bg } from "./colors-background";
export const fg = {
  DEFAULT: {
    value: {
      _light: "{colors.blacks.800}",
      _dark: "#F7F8F8",
    },
  },

  muted: {
    value: {
      _light: "{colors.blacks.600}",
      _dark: "#8B9099",
    },
  },

  subtle: {
    value: {
      _light: "{colors.blacks.400}",
      _dark: "#646973",
    },
  },

  inverted: {
    value: {
      _light: "{colors.blacks.50}",
      _dark: "{colors.blacks.800}",
    },
  },

  info: {
    value: {
      _light: "{colors.blue.700}",
      _dark: "{colors.blue.300}",
    },
  },

  warning: {
    value: {
      _light: "{colors.orange.700}",
      _dark: "{colors.orange.300}",
    },
  },

  success: {
    value: {
      _light: "{colors.green.700}",
      _dark: "{colors.green.400}",
    },
  },

  error: {
    value: {
      _light: "{colors.red.700}",
      _dark: "{colors.red.400}",
    },
  },

  accent: {
    "pink-dark": {
      value: {
        _light: "{colors.pink.700}",
        _dark: "{colors.pink.50}",
      },
    },
  },

  "green-dark": {
    value: {
      _light: "{colors.green.700}",
      _dark: "{colors.green.50}",
    },
  },

  "blue-dark": {
    value: {
      _light: "{colors.sapphire.700}",
      _dark: "{colors.sapphire.100}",
    },
  },

  "blue-very-dark": {
    value: {
      _light: "{colors.sapphire.900}",
      _dark: "{colors.sapphire.800}",
    },
  },

  button: {
    primary: {
      default: {
        value: {
          _light: "{colors.blacks.800}",
          _dark: "{colors.blacks.800}",
        },
      },
      disabled: {
        value: "{colors.fg.subtle}",
      },
    },
  },

  "menu-item": {
    default: {
      value: "{colors.fg}",
    },
    secondary: {
      value: "{colors.fg.muted}",
    },
  },
};

export const border = {
  DEFAULT: {
    value: {
      _light: "#EAF0EB",
      _dark: "#2E333F",
    },
  },

  subtle: {
    value: {
      _light: "#EDF2EE",
      _dark: "#1A1E26",
    },
  },

  inverted: {
    value: {
      _light: "{colors.neutral.600}",
      _dark: "{colors.neutral.500}",
    },
  },

  "accent-light": {
    value: {
      _light: "{colors.mint.100}",
      _dark: "{colors.mint.100}",
    },
  },

  accent: {
    value: {
      _light: "{colors.blue.700}",
      _dark: "{colors.blue.200}",
    },
  },

  info: {
    value: {
      _light: "{colors.blue.100}",
      _dark: "#113A7C",
    },
  },

  warning: {
    value: {
      _light: "{colors.orange.100}",
      _dark: "#7C3A0E",
    },
  },

  success: {
    value: {
      _light: "{colors.green.100}",
      _dark: "#0A5B24",
    },
  },

  error: {
    value: {
      _light: "{colors.red.100}",
      _dark: "{colors.red.800}",
    },
  },

  button: {
    primary: {
      value: "{colors.border.subtle}",
    },
  },
};

export const blue = {
  border: {
    value: {
      _light: "{colors.mint.200}",
      _dark: "{colors.mint.200}",
    },
  },
};

export const orange = {
  contrast: {
    value: {
      _light: "black",
      _dark: "black",
    },
  },
  fg: {
    value: {
      _light: "{colors.orange.700}",
      _dark: "{colors.orange.300}",
    },
  },
  subtle: {
    value: {
      _light: "{colors.orange.100}",
      _dark: "{colors.orange.900}",
    },
  },
  muted: {
    value: {
      _light: "{colors.orange.200}",
      _dark: "{colors.orange.800}",
    },
  },
  emphasized: {
    value: {
      _light: "{colors.orange.300}",
      _dark: "{colors.orange.700}",
    },
  },
  solid: {
    value: {
      _light: "{colors.orange.500}",
      _dark: "{colors.orange.400}",
    },
  },
  focusRing: {
    value: {
      _light: "{colors.orange.500}",
      _dark: "{colors.orange.500}",
    },
  },
  border: {
    value: {
      _light: "{colors.orange.400}",
      _dark: "{colors.orange.500}",
    },
  },
};

export const text = {
  selectable: {
    primary: {
      value: {
        _light: "{colors.blacks.800}",
        _dark: "{colors.blacks.800}",
      },
    },
  },
};

export const semanticColors = {
  fg,
  bg,
  border,
  blue,
  orange,
  vis,
  text,
};
