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

test("version selection, rename and deletion preserve the authored version and unrelated files", async () => {
  const ctx = await fixture();
  const target = { canvas, frame: "Colors" };
  await ctx.projectFiles!.writeText("src/settings.json", '{"values":{"different":true}}');
  await parameterCommands["parameters.save"].run(ctx, { ...target, values: { opacity: 0.9 }, name: "Night" });
  await parameterCommands["parameters.rename"].run(ctx, { ...target, file: "night.json", name: "Night sky" });
  const result = await parameterCommands["parameters.versions"].run(ctx, target);
  expect(result.file).toBe("night.json");
  expect(result.versions.map((version) => version.name).sort()).toEqual(["Default", "Night sky"]);
  await expect(parameterCommands["parameters.delete"].run(ctx, { ...target, file: "settings.json" })).rejects.toThrow();
  await expect(
    parameterCommands["parameters.save"].run(ctx, { ...target, file: "../outside.json", values: {} }),
  ).rejects.toThrow();
  await expect(parameterCommands["parameters.delete"].run(ctx, { ...target, file: "default.json" })).rejects.toThrow();
  await parameterCommands["parameters.delete"].run(ctx, { ...target, file: "night.json" });
  expect((await parameterCommands["parameters.versions"].run(ctx, target)).file).toBe("default.json");
  expect(await ctx.projectFiles!.exists("src/settings.json")).toBe(true);
});

test("root-value versions can be named and renamed without turning their labels into parameters", async () => {
  const manifest = testManifest();
  Object.assign(manifest.canvases[0].frames[0], { save: { file: "default.json" } });
  const { ctx } = await testContext(manifest);
  const target = { canvas, frame: "Colors" };
  await ctx.projectFiles!.writeText("src/default.json", '{"opacity":0.5}');
  await parameterCommands["parameters.save"].run(ctx, { ...target, values: { opacity: 0.8 }, name: "Night" });
  await parameterCommands["parameters.rename"].run(ctx, { ...target, file: "night.json", name: "Night sky" });
  expect((await parameterCommands["parameters.versions"].run(ctx, target)).versions).toContainEqual({
    file: "night.json",
    name: "Night sky",
    values: { opacity: 0.8 },
  });
  await parameterCommands["parameters.delete"].run(ctx, { ...target, file: "night.json" });
  expect(await ctx.projectFiles!.exists("src/night.json")).toBe(false);
});
