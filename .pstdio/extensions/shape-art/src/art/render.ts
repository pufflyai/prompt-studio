import { layoutPlacements } from "./layout";
import { createRandom, type Random } from "./random";
import { blur, fillPolygon, TEXTURE_SIZE } from "./raster";
import type { Recipe } from "./recipe";
import { type Point, resample, shapeColors, shapeContours } from "./shapes";
import { type Color, createSurface, hex, palette, type Surface } from "./surface";
import { createWash } from "./watercolor";

interface Stroke {
  contours: Point[][];
  size: number;
  from: Color;
  to: Color;
  /** Gradient axis through the stroke center, in output pixels. */
  center: Point;
  direction: Point;
  /** Fraction of pigment lost at the far end of the gradient. */
  fade: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const bounds = (surface: Surface, points: Point[], pad: number) => {
  const left = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x)) - pad));
  const top = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y)) - pad));
  const right = Math.min(surface.width - 1, Math.ceil(Math.max(...points.map((point) => point.x)) + pad));
  const bottom = Math.min(surface.height - 1, Math.ceil(Math.max(...points.map((point) => point.y)) + pad));
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
};

// Stacks translucent, slightly different outlines into a pigment mask, then lays it down with
// pooled edges, paper granulation, and a color gradient.
const paint = (surface: Surface, recipe: Recipe, random: Random, stroke: Stroke) => {
  const nextLayer = createWash(stroke.contours, stroke.size, recipe.bleed, random);
  const box = bounds(surface, stroke.contours.flat(), stroke.size * 0.3);
  if (box.width <= 0 || box.height <= 0) return;
  const mask = new Float32Array(box.width * box.height);

  for (let layer = 0; layer < recipe.layers; layer++) {
    const offsetX = random.int(0, TEXTURE_SIZE) * surface.scale + box.left;
    const offsetY = random.int(0, TEXTURE_SIZE) * surface.scale + box.top;
    const contours = nextLayer().map((contour) =>
      contour.map((point) => ({ x: point.x - box.left, y: point.y - box.top })),
    );
    fillPolygon(box.width, box.height, contours, (x, y, coverage) => {
      const blotch = 1 + recipe.texture * (surface.textureAt(surface.mottle, x + offsetX, y + offsetY) - 0.5) * 2.5;
      mask[x + y * box.width] += (coverage * Math.max(0, blotch)) / recipe.layers;
    });
  }

  // Pigment pools where the wash dries: darken just inside the edge.
  const pooled = blur(mask, box.width, box.height, Math.max(1, Math.round(stroke.size * 0.05)));
  mask.forEach((amount, index) => {
    if (amount < 0.002) return;
    const x = (index % box.width) + box.left;
    const y = Math.floor(index / box.width) + box.top;
    const along = (x - stroke.center.x) * stroke.direction.x + (y - stroke.center.y) * stroke.direction.y;
    const t = clamp(along / (stroke.size * 1.4) + 0.5, 0, 1);
    const rim = 1 + 1.3 * Math.max(0, amount - pooled[index]);
    const granulation = 1 + recipe.texture * (surface.textureAt(surface.fibers, x, y) - 0.5) * 0.8;
    const color = stroke.from.map(
      (channel, channelIndex) => channel + (stroke.to[channelIndex] - channel) * t,
    ) as Color;
    surface.deposit(x, y, color, amount * rim * granulation * (1 - stroke.fade * t));
  });
};

/** Paints a recipe into RGBA pixels. `scale` renders a smaller preview of the same composition. */
export const renderPiece = (recipe: Recipe, scale = 1) => {
  const random = createRandom(recipe.seed);
  const placements = layoutPlacements(recipe, random);
  const surface = createSurface(recipe, scale, random);

  for (const placement of placements) {
    const size = placement.size * scale;
    const cos = Math.cos(placement.rotation);
    const sin = Math.sin(placement.rotation);
    const center = { x: placement.x * scale, y: placement.y * scale };
    const from = hex(shapeColors[placement.kind]);
    const accent = random.pick(palette.filter((candidate) => candidate !== from));
    const angle = random.range(0, Math.PI * 2);
    paint(surface, recipe, random, {
      contours: shapeContours(placement.kind).map((contour) =>
        resample(contour, 0.02).map((point) => ({
          x: center.x + (point.x * cos - point.y * sin) * size,
          y: center.y + (point.x * sin + point.y * cos) * size,
        })),
      ),
      size,
      from,
      to: from.map((channel, index) => channel + (accent[index] - channel) * recipe.gradient * 0.85) as Color,
      center,
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      fade: recipe.gradient * 0.5,
    });
  }

  return surface.finish();
};
