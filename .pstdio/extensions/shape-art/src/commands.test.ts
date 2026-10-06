import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import { readPiece, renderPiece } from "./pieces/pieces";

test("generate saves a CLI-ready piece with the requested ink background and banner size", async () => {
  const files = createMemoryRepoFiles();
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {}, overrides: { projectFiles: files } });
  const command = commands["piece.generate"];
  expect(command.cli).toBeTruthy();
  const saved = await command.run(ctx, { id: "banner", background: "ink", width: 256, height: 64, seed: "test" });
  expect(saved.recipe).toMatchObject({ seed: "test", width: 256, height: 64, backgroundTop: "#0A0C10" });
  expect(await readPiece(files, "banner")).toEqual(saved.recipe);
  const png = await files.readBytes(saved.imagePath);
  const size = new DataView(png.buffer, png.byteOffset);
  expect([size.getUint32(16), size.getUint32(20)]).toEqual([256, 64]);
  await renderPiece(files, "banner");
  expect(await files.readBytes(saved.imagePath)).toEqual(png);
});
