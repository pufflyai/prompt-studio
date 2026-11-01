import { expect, test } from "bun:test";
import { parameterCommands } from "../parameters/commands";
import { testContext, testManifest } from "../test-build";
import { shaderCommands } from "./commands";

test.each(["soft", "-draft"])("shader comparison and frame menu share selected version %s", async (alternate) => {
  const manifest = testManifest();
  const canvas = "design/shaders/section-hatch/shader.canvas.tsx";
  manifest.canvases[0].id = canvas;
  Object.assign(manifest.canvases[0].frames[0], {
    exportName: "Compare",
    save: { file: "default.json", key: "values" },
  });
  const { ctx } = await testContext(manifest);
  await ctx.projectFiles!.writeText(
    "design/shaders/catalog.json",
    JSON.stringify([
      {
        id: "section-hatch",
        title: "Hatch",
        description: "Test surface",
        groups: [{ fields: [{ id: "spacing", min: 2, max: 32, step: 1, defaultValue: 8 }] }],
      },
    ]),
  );
  const target = { canvas, frame: "Compare" };
  for (const [file, spacing] of [
    ["default", 8],
    [alternate, 12],
  ] as const)
    await ctx.projectFiles!.writeText(
      `design/shaders/section-hatch/${file}.json`,
      JSON.stringify({ name: file, values: { spacing } }),
    );
  await parameterCommands["parameters.select"].run(ctx, { ...target, file: `${alternate}.json` });
  expect(await shaderCommands["compare.read"].run(ctx, { shader: "section-hatch" })).toEqual({ version: alternate });
  await shaderCommands["compare.update"].run(ctx, { shader: "section-hatch", version: "default" });
  expect((await parameterCommands["parameters.versions"].run(ctx, target)).file).toBe("default.json");
  await shaderCommands["compare.update"].run(ctx, { shader: "section-hatch" });
  expect(await shaderCommands["compare.read"].run(ctx, { shader: "section-hatch" })).toEqual({ version: null });
  await parameterCommands["parameters.select"].run(ctx, { ...target, file: `${alternate}.json` });
  await shaderCommands["version.delete"].run(ctx, { shader: "section-hatch", version: alternate });
  expect(await shaderCommands["compare.read"].run(ctx, { shader: "section-hatch" })).toEqual({ version: null });
  expect((await parameterCommands["parameters.versions"].run(ctx, target)).file).toBe("default.json");
});
