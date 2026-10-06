import { expect, test } from "bun:test";
import { createRandom } from "./random";
import { backgroundPresets, recipeSchema } from "./recipe";
import { createSurface } from "./surface";

test("ink background glows stay cool across random seeds", () => {
  for (let seed = 0; seed < 12; seed++) {
    const recipe = recipeSchema.parse({
      ...backgroundPresets.ink,
      seed: `ink-${seed}`,
      width: 64,
      height: 64,
      gradient: 1,
      grain: 1,
    });
    const { pixels } = createSurface(recipe, 1, createRandom(recipe.seed)).finish();

    for (let index = 0; index < pixels.length; index += 4) {
      expect(pixels[index + 2]).toBeGreaterThanOrEqual(pixels[index + 1]);
    }
  }
});
