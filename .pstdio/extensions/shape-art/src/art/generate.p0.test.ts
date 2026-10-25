import { expect, test } from "bun:test";
import { generateRecipe } from "./generate";
import { backgroundPresets, recipeSchema } from "./recipe";

test("generates valid random recipes while keeping the requested background and dimensions", () => {
  const recipes = Array.from({ length: 20 }, (_, index) =>
    generateRecipe({ seed: `banner-${index}`, background: "ink", width: 1600, height: 400 }),
  );
  for (const recipe of recipes) {
    expect(recipeSchema.parse(recipe)).toEqual(recipe);
    expect(recipe).toMatchObject({ width: 1600, height: 400, ...backgroundPresets.ink });
  }
  expect(new Set(recipes.map((recipe) => recipe.layout)).size).toBeGreaterThan(1);
  expect(new Set(recipes.map((recipe) => recipe.count)).size).toBeGreaterThan(1);
});

test("a seed reproduces the whole generated recipe", () => {
  const options = { seed: "replay", background: "paper", width: 256, height: 64 };
  expect(generateRecipe(options)).toEqual(generateRecipe(options));
  expect(generateRecipe(options)).toMatchObject(backgroundPresets.paper);
});

test("generation without a seed creates different reproducible pieces", () => {
  const first = generateRecipe({});
  const second = generateRecipe({});
  expect(first.seed).not.toBe(second.seed);
  expect(first).toMatchObject({ width: 1600, height: 900, ...backgroundPresets.paper });
  expect(generateRecipe({ seed: first.seed })).toEqual(first);
});

test.each([
  { background: "invalid" },
  { width: 0 },
  { height: 4097 },
  { width: 100.5 },
  { seed: "" },
])("rejects invalid generation options %j", (options) => expect(() => generateRecipe(options)).toThrow());
