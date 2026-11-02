import { expect, test } from "bun:test";
import { canvasResources } from "./resources";
import { testContext } from "./test-build";

test("global resource search finds a canvas by its title, frames and file path", async () => {
  const { ctx } = await testContext();
  const search = (query: string) => canvasResources.query(ctx, { query, limit: 10 } as never);
  const result = await search("create folder");
  expect(result.items.map((item) => item.label)).toEqual(["Create folder"]);
  expect(result.items[0]!.target).toMatchObject({ kind: "page", open: "preview", resource: { type: "canvas" } });
  expect((await search("typography")).items.map((item) => item.label)).toEqual(["Foundations"]);
  expect((await search("folder-picker.canvas")).items.map((item) => item.id)).toEqual(["src/folder-picker.canvas.tsx"]);
});
