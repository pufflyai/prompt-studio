import type { Random } from "./random";
import { createTexture, pixelNoise, TEXTURE_SIZE } from "./raster";
import type { Recipe } from "./recipe";
import { shapeColors } from "./shapes";

export type Color = [number, number, number];

export const hex = (value: string) =>
  [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16) / 255) as Color;

export const palette = [...new Set(Object.values(shapeColors))].map(hex);
// Background washes stay blue and pink on both paper and ink sheets.
const glowPalette = palette.filter(([, green, blue]) => blue >= green);

// Optical density lets paper washes glaze like real watercolor: overlapping pigments multiply.
const density = (color: Color) => color.map((channel) => -Math.log(Math.max(channel, 0.02))) as Color;

// Pigment that reaches full strength on ink keeps 7% of the background visible.
const INK_COVER = -Math.log(0.07);

const luminance = (color: Color) => 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];

/**
 * The sheet being painted. Glazing on a dark sheet would be invisible, so dark sheets ("ink") hold
 * straight color painted over the background. Light sheets hold pigment density and turn it into
 * color in `finish`, so overlapping shapes glaze.
 */
export const createSurface = (recipe: Recipe, scale: number, random: Random) => {
  const width = Math.max(1, Math.round(recipe.width * scale));
  const height = Math.max(1, Math.round(recipe.height * scale));
  const top = hex(recipe.backgroundTop);
  const bottom = hex(recipe.backgroundBottom);
  const ink = (luminance(top) + luminance(bottom)) / 2 < 0.5;
  const background = (channel: number, y: number) => top[channel] + (bottom[channel] - top[channel]) * (y / height);
  const buffer = new Float32Array(width * height * 3);
  const mottle = createTexture(random, 5);
  const fibers = createTexture(random, 48);

  // Textures are addressed in full-size pixels so previews keep the same texture scale.
  const textureAt = (texture: Float32Array, x: number, y: number) =>
    texture[(Math.floor(x / scale) & (TEXTURE_SIZE - 1)) + (Math.floor(y / scale) & (TEXTURE_SIZE - 1)) * TEXTURE_SIZE];

  const deposit = (x: number, y: number, color: Color, amount: number) => {
    const index = (x + y * width) * 3;
    if (ink) {
      const alpha = 1 - Math.exp(-amount * INK_COVER);
      for (let channel = 0; channel < 3; channel++)
        buffer[index + channel] += (color[channel] - buffer[index + channel]) * alpha;
      return;
    }
    const pigment = density(color);
    for (let channel = 0; channel < 3; channel++) buffer[index + channel] += pigment[channel] * amount;
  };

  if (ink) {
    for (let index = 0; index < width * height; index++)
      for (let channel = 0; channel < 3; channel++)
        buffer[index * 3 + channel] = background(channel, Math.floor(index / width));
  }

  // Smooth glows behind the shapes give the grainy background gradient.
  const glows = Array.from({ length: Math.round(recipe.gradient * 4) }, () => ({
    x: random.range(0, width),
    y: random.range(0, height),
    radius: Math.max(width, height) * random.range(0.3, 0.6),
    color: random.pick(glowPalette),
  }));
  for (const glow of glows) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const falloff = Math.exp((-2.5 * ((x - glow.x) ** 2 + (y - glow.y) ** 2)) / glow.radius ** 2);
        deposit(x, y, glow.color, falloff * recipe.gradient * (ink ? 0.35 : 0.22));
      }
    }
  }

  const salt = random.int(0, 1e6);
  const finish = () => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index++) {
      const x = index % width;
      const y = Math.floor(index / width);
      const grain = (pixelNoise(x, y, salt) - 0.5) * 0.16 + (textureAt(fibers, x, y) - 0.5) * 0.1;
      for (let channel = 0; channel < 3; channel++) {
        const value = buffer[index * 3 + channel];
        const color = ink ? value : background(channel, y) * Math.exp(-value);
        pixels[index * 4 + channel] = (color + grain * recipe.grain) * 255;
      }
      pixels[index * 4 + 3] = 255;
    }
    return { width, height, pixels };
  };

  return { width, height, scale, mottle, fibers, textureAt, deposit, finish };
};

export type Surface = ReturnType<typeof createSurface>;
