import { expect, test } from "bun:test";
import { recipeSchema } from "./recipe";
import { renderPiece } from "./render";

const plain = { layout: "solo", width: 120, height: 80, layers: 6, grain: 0, gradient: 0 };

const pixel = (recipe: object, x: number, y: number) => {
  const { width, pixels } = renderPiece(recipeSchema.parse(recipe));
  const index = (x + y * width) * 4;
  return [...pixels.subarray(index, index + 3)];
};

test("paints the background as a gradient between the chosen colors", () => {
  const recipe = { ...plain, backgroundTop: "#204080", backgroundBottom: "#C08040" };

  expect(pixel(recipe, 0, 0)).toEqual([32, 64, 128]);
  const bottom = pixel(recipe, 0, 79);
  expect(bottom[0]).toBeGreaterThan(180);
  expect(bottom[2]).toBeLessThan(80);
});

test("shapes stay visible on a dark custom background", () => {
  const dark = { ...plain, backgroundTop: "#101010", backgroundBottom: "#101010" };
  const [red, green, blue] = pixel(dark, 60, 40);

  expect(pixel(dark, 0, 0)).toEqual([16, 16, 16]);
  expect(red + green + blue).toBeGreaterThan(250);
});

test("shapes darken a light custom background like glazed pigment", () => {
  const light = { ...plain, backgroundTop: "#F0F0F0", backgroundBottom: "#F0F0F0" };
  const [red, green, blue] = pixel(light, 60, 40);

  expect(pixel(light, 0, 0)).toEqual([240, 240, 240]);
  expect(red + green + blue).toBeLessThan(600);
});
