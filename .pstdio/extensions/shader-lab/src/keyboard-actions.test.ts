import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { commands } from "./commands";

test("selected-version actions derive the shader and version from the chosen resource", async () => {
  const projectFiles = createMemoryRepoFiles();
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {}, overrides: { projectFiles } });
  const version = await commands["shaders.add"].run(ctx, { shader: "section-hatch" });
  await commands["current.rename"].run(ctx, {
    resource: { type: "shader-lab.version", id: `section-hatch/${version.id}` },
    name: "Chosen version",
  });
  expect(await commands["version.read"].run(ctx, { shader: "section-hatch", version: version.id })).toMatchObject({
    name: "Chosen version",
  });
});
