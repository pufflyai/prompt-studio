import type { Random } from "./random";
import type { Recipe } from "./recipe";
import { type ShapeKind, shapeAspect, shapeBaseRotation } from "./shapes";

/** One shape on the canvas, in full-size pixels. `size` is the shape height. */
export interface Placement {
  kind: ShapeKind;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

const place = (kind: ShapeKind, x: number, y: number, size: number, tilt: number) => ({
  kind,
  x,
  y,
  size,
  rotation: shapeBaseRotation[kind] + tilt,
});

// Wide shapes are drawn shorter so every shape covers a similar area.
const kindScale: Record<ShapeKind, number> = {
  page: 1,
  command: 0.42,
  editor: 1,
  skill: 0.65,
  hook: 1,
  automation: 1,
};

const radius = (placement: Placement) => (placement.size * Math.max(1, shapeAspect[placement.kind])) / 2;

// Loose rejection sampling: shapes may touch and overlap a little, which is where glazes mix.
const scatter = (recipe: Recipe, random: Random) => {
  const short = Math.min(recipe.width, recipe.height);
  const placements: Placement[] = [];
  for (let index = 0; index < recipe.count; index++) {
    const kind = random.pick(recipe.kinds);
    const size = short * random.range(0.14, 0.32) * kindScale[kind] * recipe.scale;
    let candidate = place(kind, 0, 0, size, random.gaussian(0, 0.35));
    for (let attempt = 0; attempt < 40; attempt++) {
      candidate = { ...candidate, x: random.range(0, recipe.width), y: random.range(0, recipe.height) };
      const crowded = placements.some(
        (other) =>
          Math.hypot(other.x - candidate.x, other.y - candidate.y) < (radius(other) + radius(candidate)) * 0.75,
      );
      if (!crowded) break;
    }
    placements.push(candidate);
  }
  return placements;
};

// Shapes resting on a floor, sometimes stacked, like the landing page shelf.
const shelf = (recipe: Recipe, random: Random) => {
  const floor = recipe.height * 0.97;
  const placements: Placement[] = [];
  let cursor = recipe.width * random.range(-0.02, 0.04);
  while (placements.length < recipe.count && cursor < recipe.width) {
    const kind = random.pick(recipe.kinds);
    const size = recipe.height * random.range(0.2, 0.32) * kindScale[kind] * recipe.scale;
    const width = size * shapeAspect[kind];
    const previous = placements.at(-1);
    if (previous && kind !== "command" && random.next() < 0.3) {
      const top = previous.y - previous.size / 2;
      placements.push(
        place(kind, previous.x + random.gaussian(0, size * 0.15), top - size / 2, size, random.gaussian(0, 0.08)),
      );
      continue;
    }
    placements.push(place(kind, cursor + width / 2, floor - size / 2, size, random.gaussian(0, 0.05)));
    cursor += width + recipe.width * random.range(0, 0.03);
  }
  return placements;
};

const solo = (recipe: Recipe, random: Random) => {
  const kind = random.pick(recipe.kinds);
  const fit = Math.min(recipe.height, recipe.width / shapeAspect[kind]);
  return [place(kind, recipe.width / 2, recipe.height / 2, fit * 0.62 * recipe.scale, random.gaussian(0, 0.08))];
};

const arrange = (recipe: Recipe, random: Random) => {
  if (recipe.layout === "shelf") return shelf(recipe, random);
  if (recipe.layout === "solo") return solo(recipe, random);
  return scatter(recipe, random);
};

export const layoutPlacements = (recipe: Recipe, random: Random) =>
  arrange(recipe, random).map((placement) => ({
    ...placement,
    x: placement.x + recipe.offsetX * recipe.width,
    y: placement.y + recipe.offsetY * recipe.height,
  }));
