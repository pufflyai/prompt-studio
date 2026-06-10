export const fg = {
  DEFAULT: {
    value: {
      _light: "{colors.blacks.800}",
      _dark: "{colors.blacks.200}",
    },
  },

  muted: {
    value: {
      _light: "{colors.blacks.450}",
      _dark: "{colors.blacks.500}",
    },
  },

  subtle: {
    value: {
      _light: "{colors.blacks.400}",
      _dark: "{colors.blacks.600}",
    },
  },

  inverted: {
    value: {
      _light: "{colors.blacks.50}",
      _dark: "{colors.blacks.800}",
    },
  },

  success: {
    value: {
      _light: "{colors.green.400}",
      _dark: "{colors.green.400}",
    },
  },

  error: {
    value: {
      _light: "{colors.red.400}",
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
          _light: "{colors.blacks.200}",
          _dark: "{colors.blacks.200}",
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

export const bg = {
  DEFAULT: {
    value: {
      _light: "{colors.blacks.50}",
      _dark: "{colors.blacks.900}",
    },
  },

  muted: {
    value: {
      _light: "{colors.neutral.200}",
      _dark: "{colors.neutral.800}",
    },
  },

  subtle: {
    value: {
      _light: "{colors.neutral.50}",
      _dark: "{colors.neutral.950}",
    },
  },

  hover: {
    value: {
      _light: "{colors.neutral.100}",
      _dark: "{colors.neutral.850}",
    },
  },

  active: {
    value: {
      _light: "{colors.neutral.75}",
      _dark: "{colors.blacks.850}",
    },
  },

  code: {
    value: {
      _light: "{colors.blacks.50}",
      _dark: "{colors.blacks.800}",
    },
  },

  emphasized: {
    value: {
      _light: "{colors.bg.active}",
      _dark: "{colors.bg.active}",
    },
  },

  inverted: {
    value: {
      _light: "{colors.blacks.800}",
      _dark: "{colors.blacks.100}",
    },
  },

  panel: {
    value: {
      _light: "{colors.bg}",
      _dark: "{colors.bg}",
    },
  },

  dark: {
    value: {
      _light: "{colors.blacks.900}",
      _dark: "{colors.blacks.900}",
    },
  },

  white: {
    value: {
      _light: "{colors.blacks.50}",
      _dark: "{colors.blacks.50}",
    },
  },

  button: {
    primary: {
      default: {
        value: {
          _light: "{colors.bg.accent-primary.default}",
          _dark: "{colors.bg.accent-primary.dark}",
        },
      },
      hover: {
        value: {
          _light: "{colors.bg.accent-primary.hover}",
          _dark: "{colors.bg.accent-primary.medium}",
        },
      },
      pressed: {
        value: {
          _light: "{colors.bg.accent-primary.pressed}",
          _dark: "{colors.bg.accent-primary.medium}",
        },
      },
      disabled: {
        value: "{colors.bg.muted}",
      },
    },
  },

  "menu-item": {
    default: {
      value: "{colors.bg}",
    },
    hover: {
      value: {
        _light: "{colors.bg.hover}",
        _dark: "{colors.neutral.700}",
      },
    },
    focus: {
      value: {
        _light: "{colors.bg.hover}",
        _dark: "{colors.neutral.700}",
      },
    },
    selected: {
      value: {
        _light: "{colors.bg.muted}",
        _dark: "{colors.bg.muted}",
      },
    },
  },

  display: {
    "very-light": {
      value: {
        _light: "{colors.sand.50}",
        _dark: "{colors.blacks.1000}",
      },
    },
  },

  "accent-primary": {
    default: {
      value: {
        _light: "{colors.yellow.75}",
        _dark: "{colors.yellow.75}",
      },
    },
    hover: {
      value: {
        _light: "{colors.yellow.100}",
        _dark: "{colors.yellow.100}",
      },
    },
    pressed: {
      value: {
        _light: "{colors.yellow.150}",
        _dark: "{colors.yellow.150}",
      },
    },
    "very-light": {
      value: {
        _light: "{colors.yellow.75}",
        _dark: "{colors.yellow.75}",
      },
    },
    light: {
      value: {
        _light: "{colors.yellow.75}",
        _dark: "{colors.yellow.75}",
      },
    },
    medium: {
      value: {
        _light: "{colors.yellow.100}",
        _dark: "{colors.yellow.100}",
      },
    },
    dark: {
      value: {
        _light: "{colors.yellow.150}",
        _dark: "{colors.yellow.150}",
      },
    },
  },

  "accent-secondary": {
    "grey-dark": {
      value: {
        _light: "{colors.blacks.50}",
        _dark: "{colors.blacks.1000}",
      },
    },
    "grey-light": {
      value: {
        _light: "{colors.blacks.100}",
        _dark: "{colors.blacks.900}",
      },
    },
    "red-very-light": {
      value: {
        _light: "{colors.red.50}",
        _dark: "{colors.red.100}",
      },
    },
    "red-light": {
      value: {
        _light: "{colors.red.100}",
        _dark: "{colors.red.100}",
      },
    },
    "pink-light": {
      value: {
        _light: "{colors.pink.50}",
        _dark: "{colors.pink.700}",
      },
    },
    "pink-medium": {
      value: {
        _light: "{colors.pink.100}",
        _dark: "{colors.pink.800}",
      },
    },
    "blue-very-light": {
      value: {
        _light: "{colors.blue.25}",
        _dark: "{colors.blue.50}",
      },
    },
    "blue-light": {
      value: {
        _light: "{colors.mint.100}",
        _dark: "{colors.mint.100}",
      },
    },
    "blue-medium": {
      value: {
        _light: "{colors.mint.200}",
        _dark: "{colors.mint.200}",
      },
    },
    "blue-dark": {
      value: {
        _light: "{colors.blue.700}",
        _dark: "{colors.blue.200}",
      },
    },
    "cyan-light": {
      value: {
        _light: "{colors.cyan.50}",
        _dark: "{colors.cyan.100}",
      },
    },
    "green-light": {
      value: {
        _light: "{colors.green.50}",
        _dark: "{colors.sapphire.50}",
      },
    },
    "yellow-light": {
      value: {
        _light: "{colors.yellow.75}",
        _dark: "{colors.yellow.75}",
      },
    },
    "yellow-medium": {
      value: {
        _light: "{colors.yellow.100}",
        _dark: "{colors.yellow.100}",
      },
    },
    "yellow-dark": {
      value: {
        _light: "{colors.yellow.150}",
        _dark: "{colors.yellow.150}",
      },
    },
    "sand-light": {
      value: {
        _light: "{colors.sand.100}",
        _dark: "{colors.sand.100}",
      },
    },
  },
};

export const border = {
  DEFAULT: {
    value: {
      _light: "{colors.neutral.500}",
      _dark: "{colors.neutral.600}",
    },
  },

  muted: {
    value: {
      _light: "{colors.neutral.400}",
      _dark: "{colors.neutral.700}",
    },
  },

  subtle: {
    value: {
      _light: "{colors.neutral.300}",
      _dark: "{colors.neutral.750}",
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

  button: {
    primary: {
      value: "{colors.border.muted}",
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

export const vis = {
  text: {
    primary: {
      value: {
        _light: "{colors.blacks.800}",
        _dark: "{colors.blacks.200}",
      },
    },
    secondary: {
      value: {
        _light: "{colors.blacks.600}",
        _dark: "{colors.blacks.500}",
      },
    },
  },

  grid: {
    value: {
      _light: "{colors.blacks.300}",
      _dark: "{colors.blacks.800}",
    },
  },

  axis: {
    value: {
      _light: "{colors.blacks.700}",
      _dark: "{colors.blacks.300}",
    },
  },

  categorical: {
    1: {
      value: {
        _light: "{colors.blue.300}",
        _dark: "{colors.blue.300}",
      },
    },
    2: {
      value: {
        _light: "{colors.orange.500}",
        _dark: "{colors.orange.500}",
      },
    },
    3: {
      value: {
        _light: "{colors.purple.700}",
        _dark: "{colors.purple.700}",
      },
    },
    4: {
      value: {
        _light: "{colors.red.500}",
        _dark: "{colors.red.600}",
      },
    },
    5: {
      value: {
        _light: "{colors.pink.500}",
        _dark: "{colors.pink.500}",
      },
    },
    6: {
      value: {
        _light: "{colors.cyan.800}",
        _dark: "{colors.green.500}",
      },
    },
    7: {
      value: {
        _light: "{colors.red.200}",
        _dark: "{colors.cyan.700}",
      },
    },
  },

  sequential: {
    blue: {
      "low-3": {
        value: {
          _light: "{colors.blue.200}",
          _dark: "{colors.blue.800}",
        },
      },
      "low-2": {
        value: {
          _light: "{colors.blue.300}",
          _dark: "{colors.blue.700}",
        },
      },
      "low-1": {
        value: {
          _light: "{colors.blue.400}",
          _dark: "{colors.blue.600}",
        },
      },
      default: {
        value: {
          _light: "{colors.blue.500}",
          _dark: "{colors.blue.500}",
        },
      },
      "high-1": {
        value: {
          _light: "{colors.blue.600}",
          _dark: "{colors.blue.400}",
        },
      },
      "high-2": {
        value: {
          _light: "{colors.blue.700}",
          _dark: "{colors.blue.300}",
        },
      },
      "high-3": {
        value: {
          _light: "{colors.blue.800}",
          _dark: "{colors.blue.200}",
        },
      },
    },
    red: {
      "low-3": {
        value: {
          _light: "{colors.red.200}",
          _dark: "{colors.red.800}",
        },
      },
      "low-2": {
        value: {
          _light: "{colors.red.300}",
          _dark: "{colors.red.700}",
        },
      },
      "low-1": {
        value: {
          _light: "{colors.red.400}",
          _dark: "{colors.red.600}",
        },
      },
      default: {
        value: {
          _light: "{colors.red.500}",
          _dark: "{colors.red.500}",
        },
      },
      "high-1": {
        value: {
          _light: "{colors.red.600}",
          _dark: "{colors.red.400}",
        },
      },
      "high-2": {
        value: {
          _light: "{colors.red.700}",
          _dark: "{colors.red.300}",
        },
      },
      "high-3": {
        value: {
          _light: "{colors.red.800}",
          _dark: "{colors.red.200}",
        },
      },
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
