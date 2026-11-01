import { expect, test } from "bun:test";
import { testContext, testManifest } from "../test-build";
import { parameterCommands } from "./commands";
import type { Values } from "./model";

const canvas = "src/foundations.canvas.tsx";
const fixture = async () => {
  const manifest = testManifest();
  Object.assign(manifest.canvases[0].frames[0], { save: { file: "default.json", key: "values" } });
  const { ctx } = await testContext(manifest);
  await ctx.projectFiles!.writeText("src/default.json", JSON.stringify({ name: "Default", values: { opacity: 0.5 } }));
  return ctx;
};

test("only an explicit save changes the authored values, and new versions survive another read", async () => {
  const ctx = await fixture();
  await parameterCommands["parameters.save"].run(ctx, {
    canvas,
    frame: "Colors",
    values: { opacity: 0.8 },
    name: "Soft dots",
  });
  const original = JSON.parse(await ctx.projectFiles!.readText("src/default.json"));
  expect(original.values.opacity).toBe(0.5);
  const result = await parameterCommands["parameters.versions"].run(ctx, { canvas, frame: "Colors" });
  expect(result.versions).toContainEqual(
    expect.objectContaining({ file: "soft-dots.json", name: "Soft dots", values: { opacity: 0.8 } }),
  );
});

test("save errors leave existing design data intact", async () => {
  const ctx = await fixture();
  const changes: Values[] = [{ opacity: "wrong type" }, { unknown: 3 }];
  for (const values of changes) {
    await expect(parameterCommands["parameters.save"].run(ctx, { canvas, frame: "Colors", values })).rejects.toThrow();
  }
  expect(JSON.parse(await ctx.projectFiles!.readText("src/default.json")).values.opacity).toBe(0.5);
});
