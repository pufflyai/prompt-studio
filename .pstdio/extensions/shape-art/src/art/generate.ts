import { z } from "zod";
import { createRandom } from "./random";
import { backgroundPresets, layouts, recipeSchema } from "./recipe";
import { shapeKinds } from "./shapes";

const generationSchema = recipeSchema.pick({ width: true, height: true }).extend({
  background: z.enum(["paper", "ink"]).default("paper"),
  seed: z.string().min(1).optional(),
});

/** Save the seed with the recipe so a random piece can be reproduced and edited later. */
export const generateRecipe = (input: unknown) => {
  const { background, width, height, seed = crypto.randomUUID() } = generationSchema.parse(input);
  const random = createRandom(seed);
  const kinds = shapeKinds.filter(() => random.next() < 0.7);
  return recipeSchema.parse({
    seed,
    width,
    height,
    ...backgroundPresets[background],
    layout: random.pick(layouts),
    kinds: kinds.length ? kinds : [random.pick(shapeKinds)],
    count: random.int(8, 24),
    scale: random.range(0.8, 1.6),
    offsetX: random.range(-0.06, 0.06),
    offsetY: random.range(-0.08, 0.02),
    bleed: random.range(0.2, 0.7),
    layers: random.int(24, 48),
    texture: random.range(0.35, 0.8),
    gradient: random.range(0.3, 0.75),
    grain: random.range(0.2, 0.55),
  });
};
