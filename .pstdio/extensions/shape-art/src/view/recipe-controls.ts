import type { InputGroup, ParamValue } from "@pstdio/ui/param-editor";
import { backgroundPresets, layouts, type Recipe } from "../art/recipe";
import { type ShapeKind, shapeKinds } from "../art/shapes";

const title = (value: string) => value[0].toUpperCase() + value.slice(1);
type Preset = keyof typeof backgroundPresets;

// The preset is read from the colors, so the recipe keeps one source of truth.
const matchingPreset = (recipe: Recipe) =>
  (Object.keys(backgroundPresets) as Preset[]).find(
    (preset) =>
      backgroundPresets[preset].backgroundTop.toLowerCase() === recipe.backgroundTop.toLowerCase() &&
      backgroundPresets[preset].backgroundBottom.toLowerCase() === recipe.backgroundBottom.toLowerCase(),
  ) ?? "custom";

const unit = (id: keyof Recipe, name: string, value: number, description: string) => ({
  id,
  name,
  type: "number" as const,
  defaultValue: value,
  min: 0,
  max: 1,
  step: 0.05,
  description,
});

export const recipeGroups = (recipe: Recipe): InputGroup[] => [
  {
    id: "composition",
    title: "Composition",
    params: [
      {
        id: "layout",
        name: "Layout",
        type: "segmented",
        defaultValue: recipe.layout,
        options: layouts.map((layout) => ({ id: layout, name: title(layout) })),
      },
      {
        id: "kinds",
        name: "Shapes",
        type: "selection",
        multiSelect: true,
        defaultValue: recipe.kinds,
        options: shapeKinds.map((kind) => ({ id: kind, name: title(kind) })),
      },
      { id: "count", name: "Count", type: "number", defaultValue: recipe.count, min: 1, max: 40, step: 1 },
      {
        id: "scale",
        name: "Scale",
        type: "number",
        defaultValue: recipe.scale,
        min: 0.2,
        max: 3,
        step: 0.05,
        description: "Multiplies every shape's size.",
      },
      {
        id: "offsetX",
        name: "Offset X",
        type: "number",
        defaultValue: recipe.offsetX,
        min: -1,
        max: 1,
        step: 0.01,
        description: "Moves the shapes sideways, as a fraction of the canvas width.",
      },
      {
        id: "offsetY",
        name: "Offset Y",
        type: "number",
        defaultValue: recipe.offsetY,
        min: -1,
        max: 1,
        step: 0.01,
        description: "Moves the shapes up or down, as a fraction of the canvas height. Negative lifts the shelf.",
      },
      { id: "seed", name: "Seed", type: "text", singleLine: true, defaultValue: recipe.seed },
    ],
  },
  {
    id: "paint",
    title: "Paint",
    params: [
      {
        id: "preset",
        name: "Background",
        type: "segmented",
        defaultValue: matchingPreset(recipe),
        options: [...Object.keys(backgroundPresets), "custom"].map((preset) => ({ id: preset, name: title(preset) })),
      },
      {
        id: "backgroundTop",
        name: "Top color",
        type: "color",
        defaultValue: recipe.backgroundTop,
        description: "Light backgrounds glaze the shapes like watercolor; dark ones take opaque paint.",
      },
      { id: "backgroundBottom", name: "Bottom color", type: "color", defaultValue: recipe.backgroundBottom },
      unit("bleed", "Bleed", recipe.bleed, "How far the pigment wanders past the shape outline."),
      unit("texture", "Texture", recipe.texture, "Blotchy, uneven pigment inside each shape."),
      unit("gradient", "Gradient", recipe.gradient, "Color drift across each shape and the background glow."),
      unit("grain", "Grain", recipe.grain, "Film grain over the whole image."),
      {
        id: "layers",
        name: "Layers",
        type: "number",
        defaultValue: recipe.layers,
        min: 4,
        max: 80,
        step: 1,
        description: "More translucent layers give softer edges.",
      },
    ],
  },
  {
    id: "canvas",
    title: "Canvas",
    params: [
      { id: "width", name: "Width", type: "number", defaultValue: recipe.width, step: 1 },
      { id: "height", name: "Height", type: "number", defaultValue: recipe.height, step: 1 },
    ],
  },
];

/** Applies one editor change. Invalid values (such as an empty shape list) keep the previous recipe. */
export const applyChange = (recipe: Recipe, id: string, value: ParamValue): Recipe => {
  if (id === "kinds") {
    const kinds = (Array.isArray(value) ? value : [value]) as ShapeKind[];
    return kinds.length > 0 ? { ...recipe, kinds } : recipe;
  }
  if (id === "preset")
    return String(value) in backgroundPresets ? { ...recipe, ...backgroundPresets[value as Preset] } : recipe;
  // The color picker may append an alpha channel; the sheet is always opaque.
  if (id === "backgroundTop" || id === "backgroundBottom") return { ...recipe, [id]: String(value).slice(0, 7) };
  if (id === "seed" && (typeof value !== "string" || value.trim() === "")) return recipe;
  return { ...recipe, [id]: value };
};
