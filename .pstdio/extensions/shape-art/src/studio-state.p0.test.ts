import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { readPiece } from "./pieces/pieces";
import { settingsView } from "./settings-view";
import { studioCommands } from "./studio-commands";
import { readStudio, updateStudio } from "./studio-state";

const context = () =>
  makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: { projectFiles: createMemoryRepoFiles() },
  });

test("native settings and preview share the current draft after the menu is reopened", async () => {
  const ctx = context();
  const renderer = {} as never;
  const controls = settingsView.body;
  await controls.onValueChange(ctx, { renderer, controlId: "seed", value: "retained-art", values: {} });
  await controls.onValueChange(ctx, { renderer, controlId: "preset", value: "ink", values: {} });
  const preview = await studioCommands["studio.read"].run(ctx, {});
  expect(preview.recipe).toMatchObject({ seed: "retained-art", backgroundTop: "#0A0C10", backgroundBottom: "#141A28" });
  const reopened = await controls.query(ctx);
  expect(reopened.values).toMatchObject({ seed: "retained-art", backgroundTop: "#0A0C10" });
  await updateStudio(ctx, "seed", "second-seed");
  expect((await readStudio(ctx)).recipe).toMatchObject({ seed: "second-seed", backgroundTop: "#0A0C10" });
});

test("native draft changes can be saved, opened, and deleted through public commands", async () => {
  const ctx = context();
  for (const [id, value] of Object.entries({ id: "native-art", width: 64, height: 64, layers: 4, seed: "native" }))
    await studioCommands["studio.set"].run(ctx, { controlId: id, value });
  const saved = await studioCommands["studio.save"].run(ctx, {});
  expect(await readPiece(ctx.projectFiles!, "native-art")).toEqual(saved.recipe);
  await updateStudio(ctx, "piece", "new");
  expect((await readStudio(ctx)).selected).toBe("new");
  await updateStudio(ctx, "piece", "native-art");
  expect((await readStudio(ctx)).recipe.seed).toBe("native");
  await studioCommands["studio.delete"].run(ctx, {});
  expect(await readStudio(ctx)).toMatchObject({ selected: "new", id: "untitled" });
  expect(await ctx.projectFiles!.exists("design/art/native-art.json")).toBe(false);
});
