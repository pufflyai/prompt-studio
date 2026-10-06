import { z } from "zod";
import { shapeKinds } from "./shapes";

export const layouts = ["scatter", "shelf", "solo"] as const;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB color");

/** Ready-made sheets. Light sheets glaze pigment like watercolor; dark sheets take opaque paint. */
export const backgroundPresets = {
  paper: { backgroundTop: "#F7F2E8", backgroundBottom: "#EAE1D1" },
  ink: { backgroundTop: "#0A0C10", backgroundBottom: "#141A28" },
};

/** Everything needed to paint a piece again. Missing fields take the defaults. */
export const recipeSchema = z.object({
  seed: z.string().min(1).default("prompt-studio"),
  width: z.number().int().min(64).max(4096).default(1600),
  height: z.number().int().min(64).max(4096).default(900),
  layout: z.enum(layouts).default("scatter"),
  kinds: z
    .array(z.enum(shapeKinds))
    .min(1)
    .default([...shapeKinds]),
  count: z.number().int().min(1).max(40).default(9),
  /** Multiplies every shape's size. */
  scale: z.number().min(0.2).max(3).default(1),
  /** Moves the whole composition, as a fraction of the canvas width and height. */
  offsetX: z.number().min(-1).max(1).default(0),
  offsetY: z.number().min(-1).max(1).default(0),
  /** The sheet is a vertical gradient from the top color to the bottom color. */
  backgroundTop: color.default(backgroundPresets.paper.backgroundTop),
  backgroundBottom: color.default(backgroundPresets.paper.backgroundBottom),
  /** How far the pigment wanders past the shape outline. */
  bleed: z.number().min(0).max(1).default(0.4),
  /** More translucent layers give softer edges. */
  layers: z.number().int().min(4).max(80).default(36),
  /** Blotchy, uneven pigment inside each shape. */
  texture: z.number().min(0).max(1).default(0.6),
  /** Color drift across each shape and the background wash. */
  gradient: z.number().min(0).max(1).default(0.5),
  grain: z.number().min(0).max(1).default(0.4),
});

export type Recipe = z.infer<typeof recipeSchema>;

export const defaultRecipe = () => recipeSchema.parse({});
