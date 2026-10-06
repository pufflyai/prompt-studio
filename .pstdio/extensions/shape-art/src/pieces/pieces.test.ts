import { expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import { createMemoryRepoFiles } from "@pstdio/sdk/testing";
import { deletePiece, listPieces, readPiece, renderPiece, savePiece } from "./pieces";

const small = { seed: "hero", width: 96, height: 64, layers: 6 };

const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

test("saves a recipe with defaults and paints it as a PNG next to it", async () => {
  const files = createMemoryRepoFiles();
  const saved = await savePiece(files, "hero", small);

  expect(saved.recipe).toMatchObject({ ...small, layout: "scatter", backgroundTop: "#F7F2E8" });
  expect(await readPiece(files, "hero")).toEqual(saved.recipe);
  const png = await files.readBytes("design/art/hero.png");
  expect([...png.subarray(1, 4)].map((byte) => String.fromCharCode(byte)).join("")).toBe("PNG");
  expect(pngSize(png)).toEqual({ width: 96, height: 64 });
  expect(await listPieces(files)).toEqual([{ id: "hero", image: "design/art/hero.png" }]);
});

test("lists pieces by file name", async () => {
  const files = createMemoryRepoFiles();
  await savePiece(files, "night-shelf", small);
  await savePiece(files, "dawn", small);
  expect((await listPieces(files)).map((piece) => piece.id)).toEqual(["dawn", "night-shelf"]);
});

test("repaints the same pixels from the saved recipe", async () => {
  const files = createMemoryRepoFiles();
  await savePiece(files, "hero", small);
  const first = await files.readBytes("design/art/hero.png");
  await renderPiece(files, "hero");
  expect(await files.readBytes("design/art/hero.png")).toEqual(first);
});

test("decodes to opaque pixels that differ from the bare paper", async () => {
  const files = createMemoryRepoFiles();
  await savePiece(files, "solo", { ...small, layout: "solo", grain: 0, gradient: 0 });
  const png = await files.readBytes("design/art/solo.png");
  const idat = png.indexOf(0x49, 33);
  const length = new DataView(png.buffer, png.byteOffset).getUint32(idat - 4);
  const rows = inflateSync(png.subarray(idat + 4, idat + 4 + length));
  const stride = 96 * 3 + 1;
  const pixel = (x: number, y: number) => [...rows.subarray(y * stride + 1 + x * 3, y * stride + 4 + x * 3)];
  const corner = pixel(0, 0);
  const center = pixel(48, 32);
  expect(Math.abs(center[0] - corner[0]) + Math.abs(center[2] - corner[2])).toBeGreaterThan(60);
});

test("deletes the recipe and its image", async () => {
  const files = createMemoryRepoFiles();
  await savePiece(files, "hero", small);
  await deletePiece(files, "hero");
  expect(await listPieces(files)).toEqual([]);
  expect(await files.exists("design/art/hero.png")).toBe(false);
});

test.each(["../outside", "Upper", "a/b"])("rejects piece id %s", async (id) => {
  await expect(savePiece(createMemoryRepoFiles(), id, small)).rejects.toThrow();
});
