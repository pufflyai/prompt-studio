export const fg = {
  DEFAULT: {
    value: {
      base: "{colors.blacks.800}",
      _dark: "{colors.blacks.200}",
    },
  },

  muted: {
    value: {
      base: "{colors.blacks.500}",
      _dark: "{colors.blacks.500}",
    },
  },

  subtle: {
    value: {
      base: "{colors.blacks.400}",
      _dark: "{colors.blacks.600}",
    },
  },

  inverted: {
    value: {
      base: "{colors.blacks.50}",
      _dark: "{colors.blacks.800}",
    },
  },

  success: {
    value: {
      base: "{colors.green.400}",
      _dark: "{colors.green.400}",
    },
  },

  error: {
    value: {
      base: "{colors.red.400}",
      _dark: "{colors.red.400}",
    },
  },

  accent: {
    "pink-dark": {
      value: {
        base: "{colors.pink.700}",
        _dark: "{colors.pink.50}",
      },
    },
  },

  "green-dark": {
    value: {
      base: "{colors.green.700}",
      _dark: "{colors.green.50}",
    },
  },

  "blue-dark": {
    value: {
      base: "{colors.sapphire.700}",
      _dark: "{colors.sapphire.100}",
    },
  },

  "blue-very-dark": {
    value: {
      base: "{colors.sapphire.900}",
      _dark: "{colors.sapphire.800}",
    },
  },

  button: {
    primary: {
      default: {
        value: {
          base: "{colors.blacks.200}",
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
      base: "{colors.blacks.50}",
      _dark: "{colors.blacks.900}",
    },
  },

  muted: {
    value: {
      base: "{colors.blacks.200}",
      _dark: "{colors.blacks.800}",
    },
  },

  subtle: {
    value: {
      base: "{colors.blacks.75}",
      _dark: "{colors.blacks.850}",
    },
  },

  code: {
    value: {
      base: "{colors.blacks.50}",
      _dark: "{colors.blacks.800}",
    },
  },

  emphasized: {
    value: {
      base: "{colors.blacks.50}",
      _dark: "{colors.blacks.600}",
    },
  },

  inverted: {
    value: {
      base: "{colors.blacks.800}",
      _dark: "{colors.blacks.100}",
    },
  },

  panel: {
    value: {
      base: "{colors.blacks.100}",
      _dark: "{colors.blacks.850}",
    },
  },

  dark: {
    value: {
      base: "{colors.blacks.900}",
      _dark: "{colors.blacks.900}",
    },
  },

  white: {
    value: {
      base: "{colors.blacks.50}",
      _dark: "{colors.blacks.50}",
    },
  },

  button: {
    primary: {
      default: {
        value: "{colors.bg.accent-primary.default}",
      },
      hover: {
        value: "{colors.bg.accent-primary.hover}",
      },
      pressed: {
        value: "{colors.bg.accent-primary.pressed}",
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
      value: "{colors.bg.muted}",
    },
    focus: {
      value: "{colors.bg.muted}",
    },
    selected: {
      value: "{colors.bg.muted}",
    },
  },

  display: {
    "very-light": {
      value: {
        base: "{colors.sand.50}",
        _dark: "{colors.blacks.1000}",
      },
    },
  },

  "accent-primary": {
    default: {
      value: {
        base: "{colors.orange.100}",
        _dark: "{colors.orange.300}",
      },
    },
    hover: {
      value: {
        base: "{colors.orange.200}",
        _dark: "{colors.orange.200}",
      },
    },
    pressed: {
      value: {
        base: "{colors.orange.300}",
        _dark: "{colors.orange.100}",
      },
    },
    "very-light": {
      value: {
        base: "{colors.orange.100}",
        _dark: "{colors.blacks.1000}",
      },
    },
    light: {
      value: {
        base: "{colors.orange.100}",
        _dark: "{colors.orange.300}",
      },
    },
    medium: {
      value: {
        base: "{colors.orange.200}",
        _dark: "{colors.orange.200}",
      },
    },
    dark: {
      value: {
        base: "{colors.orange.300}",
        _dark: "{colors.orange.100}",
      },
    },
  },

  "accent-secondary": {
    "grey-dark": {
      value: {
        base: "{colors.blacks.50}",
        _dark: "{colors.blacks.1000}",
      },
    },
    "grey-light": {
      value: {
        base: "{colors.blacks.100}",
        _dark: "{colors.blacks.900}",
      },
    },
    "red-very-light": {
      value: {
        base: "{colors.red.50}",
        _dark: "{colors.red.100}",
      },
    },
    "red-light": {
      value: {
        base: "{colors.red.100}",
        _dark: "{colors.red.100}",
      },
    },
    "pink-light": {
      value: {
        base: "{colors.pink.50}",
        _dark: "{colors.pink.700}",
      },
    },
    "pink-medium": {
      value: {
        base: "{colors.pink.100}",
        _dark: "{colors.pink.800}",
      },
    },
    "blue-very-light": {
      value: {
        base: "{colors.blue.25}",
        _dark: "{colors.blue.50}",
      },
    },
    "blue-light": {
      value: {
        base: "{colors.blue.50}",
        _dark: "{colors.blue.700}",
      },
    },
    "blue-medium": {
      value: {
        base: "{colors.blue.100}",
        _dark: "{colors.blue.800}",
      },
    },
    "blue-dark": {
      value: {
        base: "{colors.blue.700}",
        _dark: "{colors.blue.200}",
      },
    },
    "cyan-light": {
      value: {
        base: "{colors.cyan.50}",
        _dark: "{colors.cyan.100}",
      },
    },
    "green-light": {
      value: {
        base: "{colors.green.50}",
        _dark: "{colors.sapphire.50}",
      },
    },
    "yellow-light": {
      value: {
        base: "{colors.yellow.50}",
        _dark: "{colors.yellow.100}",
      },
    },
    "yellow-medium": {
      value: {
        base: "{colors.yellow.100}",
        _dark: "{colors.yellow.200}",
      },
    },
    "sand-light": {
      value: {
        base: "{colors.sand.100}",
        _dark: "{colors.sand.100}",
      },
    },
  },
};

export const border = {
  DEFAULT: {
    value: {
      base: "{colors.blacks.400}",
      _dark: "{colors.blacks.600}",
    },
  },

  muted: {
    value: {
      base: "{colors.blacks.300}",
      _dark: "{colors.blacks.700}",
    },
  },

  subtle: {
    value: {
      base: "{colors.blacks.300}",
      _dark: "{colors.blacks.50}",
    },
  },

  inverted: {
    value: {
      base: "{colors.blacks.400}",
      _dark: "{colors.blacks.600}",
    },
  },

  "accent-light": {
    value: {
      base: "{colors.blue.200}",
      _dark: "{colors.blue.900}",
    },
  },

  accent: {
    value: {
      base: "{colors.blue.700}",
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
      base: "{colors.blue.700}",
      _dark: "{colors.blue.200}",
    },
  },
};

export const vis = {
  text: {
    primary: {
      value: {
        base: "{colors.blacks.800}",
        _dark: "{colors.blacks.200}",
      },
    },
    secondary: {
      value: {
        base: "{colors.blacks.600}",
        _dark: "{colors.blacks.500}",
      },
    },
  },

  grid: {
    value: {
      base: "{colors.blacks.300}",
      _dark: "{colors.blacks.800}",
    },
  },

  axis: {
    value: {
      base: "{colors.blacks.700}",
      _dark: "{colors.blacks.300}",
    },
  },

  categorical: {
    1: {
      value: {
        base: "{colors.blue.300}",
        _dark: "{colors.blue.300}",
      },
    },
    2: {
      value: {
        base: "{colors.orange.500}",
        _dark: "{colors.orange.500}",
      },
    },
    3: {
      value: {
        base: "{colors.purple.700}",
        _dark: "{colors.purple.700}",
      },
    },
    4: {
      value: {
        base: "{colors.red.500}",
        _dark: "{colors.red.600}",
      },
    },
    5: {
      value: {
        base: "{colors.pink.500}",
        _dark: "{colors.pink.500}",
      },
    },
    6: {
      value: {
        base: "{colors.cyan.800}",
        _dark: "{colors.green.500}",
      },
    },
    7: {
      value: {
        base: "{colors.red.200}",
        _dark: "{colors.cyan.700}",
      },
    },
  },

  sequential: {
    blue: {
      "low-3": {
        value: {
          base: "{colors.blue.200}",
          _dark: "{colors.blue.800}",
        },
      },
      "low-2": {
        value: {
          base: "{colors.blue.300}",
          _dark: "{colors.blue.700}",
        },
      },
      "low-1": {
        value: {
          base: "{colors.blue.400}",
          _dark: "{colors.blue.600}",
        },
      },
      default: {
        value: {
          base: "{colors.blue.500}",
          _dark: "{colors.blue.500}",
        },
      },
      "high-1": {
        value: {
          base: "{colors.blue.600}",
          _dark: "{colors.blue.400}",
        },
      },
      "high-2": {
        value: {
          base: "{colors.blue.700}",
          _dark: "{colors.blue.300}",
        },
      },
      "high-3": {
        value: {
          base: "{colors.blue.800}",
          _dark: "{colors.blue.200}",
        },
      },
    },
    red: {
      "low-3": {
        value: {
          base: "{colors.red.200}",
          _dark: "{colors.red.800}",
        },
      },
      "low-2": {
        value: {
          base: "{colors.red.300}",
          _dark: "{colors.red.700}",
        },
      },
      "low-1": {
        value: {
          base: "{colors.red.400}",
          _dark: "{colors.red.600}",
        },
      },
      default: {
        value: {
          base: "{colors.red.500}",
          _dark: "{colors.red.500}",
        },
      },
      "high-1": {
        value: {
          base: "{colors.red.600}",
          _dark: "{colors.red.400}",
        },
      },
      "high-2": {
        value: {
          base: "{colors.red.700}",
          _dark: "{colors.red.300}",
        },
      },
      "high-3": {
        value: {
          base: "{colors.red.800}",
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
        base: "{colors.blacks.800}",
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
  vis,
  text,
};
