// Shader definitions are plain data, shared by commands, controls, and the preview.
export interface ShaderField {
  id: string;
  name: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface ShaderGroup {
  id: string;
  title: string;
  description: string;
  fields: ShaderField[];
}

export interface ShaderDefinition {
  id: string;
  title: string;
  description: string;
  groups: ShaderGroup[];
}

export type ShaderValues = Record<string, number>;

const field = (
  id: string,
  name: string,
  description: string,
  range: [number, number, number],
  defaultValue: number,
) => {
  const [min, max, step] = range;
  return { id, name, description, min, max, step, defaultValue };
};

// Thin lines show more on light backgrounds, so each shader starts with a lower light-theme opacity.
const opacity = (light: number, dark: number): ShaderGroup => ({
  id: "opacity",
  title: "Opacity",
  description: "Peak line opacity in each theme.",
  fields: [
    field("lightOpacity", "Light theme", "Usually lower than dark to look the same.", [0, 1, 0.005], light),
    field("darkOpacity", "Dark theme", "Usually higher than light to look the same.", [0, 1, 0.005], dark),
  ],
});

const noise: ShaderGroup = {
  id: "noise",
  title: "Noise",
  description: "Drifting patches that vary the pattern's transparency.",
  fields: [
    field("noiseScale", "Scale", "Patch size in px.", [20, 800, 10], 200),
    field("noiseContrast", "Contrast", "Low is a soft gradient; high gives sharp patches.", [0, 5, 0.1], 1.6),
    field("noiseBalance", "Balance", "Negative hides more of the pattern; 1 turns the noise off.", [-1, 1, 0.05], 0),
    field("noiseDrift", "Drift", "Patch movement in px per second.", [0, 60, 1], 5),
    field("noiseDetail", "Detail", "Noise octaves. More adds finer variation.", [1, 4, 1], 1),
    field("seed", "Seed", "Picks a different noise layout.", [0, 100, 1], 7),
  ],
};

const pattern = (description: string, fields: ShaderField[]): ShaderGroup => ({
  id: "pattern",
  title: "Pattern",
  description,
  fields,
});

export const shaders: ShaderDefinition[] = [
  {
    id: "section-hatch",
    title: "Section hatch",
    description: "Diagonal hatching, like a cut section in an engineering drawing.",
    groups: [
      pattern("Diagonal lines that drift slowly.", [
        field("spacing", "Spacing", "Distance between lines in px.", [2, 32, 1], 8),
        field("angle", "Angle", "Line angle in degrees.", [0, 180, 1], 45),
        field("lineWidth", "Width", "Stroke width in px.", [0.5, 3, 0.25], 1),
        field("lineDrift", "Drift", "Line movement in px per second.", [0, 30, 0.5], 3),
      ]),
      opacity(0.06, 0.17),
      noise,
    ],
  },
  {
    id: "dots-to-grid",
    title: "Dots to grid",
    description: "A dot grid that resolves into a line grid where a soft band passes.",
    groups: [
      pattern("A drafting sheet: dots everywhere, lines inside the moving band.", [
        field("spacing", "Spacing", "Grid cell size in px.", [4, 32, 1], 8),
        field("dotSize", "Dot size", "Dot width in px.", [0.5, 3, 0.25], 1),
        field("lineStrength", "Line strength", "Grid line opacity relative to the dots.", [0, 1, 0.05], 0.75),
        field("bandWidth", "Band width", "Share of the surface the band covers.", [0.1, 1, 0.05], 0.4),
        field("cycle", "Cycle", "Seconds for the band to cross the surface.", [1, 15, 0.5], 4.5),
      ]),
      opacity(0.3, 0.5),
      noise,
    ],
  },
  {
    id: "plotter-crosshair",
    title: "Plotter crosshair",
    description: "A dashed crosshair wanders over a faint grid.",
    groups: [
      pattern("A plotter head over graph paper.", [
        field("gridSpacing", "Grid spacing", "Grid cell size in px.", [4, 40, 1], 12),
        field("gridStrength", "Grid strength", "Grid opacity relative to the crosshair.", [0, 1, 0.05], 0.25),
        field("speed", "Speed", "How fast the crosshair moves.", [0, 4, 0.1], 1),
        field("markerSize", "Marker size", "Size of the square at the crossing in px.", [2, 16, 1], 6),
      ]),
      opacity(0.4, 0.6),
      noise,
    ],
  },
  {
    id: "ruler-ticks",
    title: "Ruler ticks",
    description: "Ruler ticks slide along the top and bottom edges.",
    groups: [
      pattern("A measuring scale along the edges.", [
        field("tickSpacing", "Tick spacing", "Distance between ticks in px.", [2, 16, 1], 4),
        field("majorEvery", "Major every", "Ticks between major ticks.", [2, 10, 1], 5),
        field("majorLength", "Major length", "Major tick length in px.", [2, 16, 1], 5),
        field("minorLength", "Minor length", "Minor tick length in px.", [1, 8, 1], 2),
        field("speed", "Speed", "Tick movement in px per second.", [0, 60, 1], 12),
      ]),
      opacity(0.5, 0.7),
      noise,
    ],
  },
  {
    id: "dashed-outline",
    title: "Dashed outline",
    description: "A moving dashed line runs just inside the border.",
    groups: [
      pattern("A marked-up region.", [
        field("dash", "Dash", "Dash length in px.", [1, 20, 0.5], 4),
        field("gap", "Gap", "Gap length in px.", [1, 20, 0.5], 3),
        field("inset", "Inset", "Distance from the border in px.", [0.5, 8, 0.5], 2.5),
        field("speed", "Speed", "Dash movement in px per second.", [0, 60, 1], 10),
      ]),
      opacity(0.5, 0.75),
      noise,
    ],
  },
];

export const findShader = (id: string) => {
  const shader = shaders.find((definition) => definition.id === id);
  if (!shader) throw new Error(`Unknown shader "${id}"`);
  return shader;
};

const shaderFields = (shader: ShaderDefinition) => shader.groups.flatMap((group) => group.fields);

export const defaultValues = (shader: ShaderDefinition) =>
  Object.fromEntries(shaderFields(shader).map((item) => [item.id, item.defaultValue])) as ShaderValues;

// Accepts any saved or submitted value; each field falls back to its default and stays in range.
export const normalizeValues = (shader: ShaderDefinition, value: unknown) => {
  const input = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    shaderFields(shader).map((item) => {
      const raw = input[item.id];
      const number = typeof raw === "number" && Number.isFinite(raw) ? raw : item.defaultValue;
      return [item.id, Math.min(item.max, Math.max(item.min, number))];
    }),
  ) as ShaderValues;
};
