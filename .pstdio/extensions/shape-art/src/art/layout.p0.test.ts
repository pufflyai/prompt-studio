import { expect, test } from "bun:test";
import { layoutPlacements } from "./layout";
import { createRandom } from "./random";
import { recipeSchema } from "./recipe";

const placements = (recipe: object) => layoutPlacements(recipeSchema.parse(recipe), createRandom("layout"));

test("offset moves the whole shelf by a fraction of the canvas", () => {
  const base = placements({ layout: "shelf", width: 1000, height: 500 });
  const moved = placements({ layout: "shelf", width: 1000, height: 500, offsetX: 0.1, offsetY: -0.2 });

  expect(moved.map((placement) => [placement.x, placement.y])).toEqual(
    base.map((placement) => [placement.x + 100, placement.y - 100]),
  );
});

test("scale multiplies shape sizes", () => {
  const [base] = placements({ layout: "solo" });
  const [scaled] = placements({ layout: "solo", scale: 1.5 });

  expect(scaled.size).toBeCloseTo(base.size * 1.5);
});

test("a smaller shelf scale fits more shapes on the shelf", () => {
  const recipe = { layout: "shelf", count: 40, kinds: ["page"] };

  expect(placements({ ...recipe, scale: 0.5 }).length).toBeGreaterThan(placements(recipe).length);
});
