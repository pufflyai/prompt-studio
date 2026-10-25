import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { commands } from "./state-commands";

const context = () => makeCommandContext({ storage: createMemoryStorage(), params: {} });
test("sample documents work immediately and keep edits across reads", async () => {
  const ctx = context();
  const resources = await commands["resources.query"].run(ctx as never, { name: "scribble" });
  expect(resources.length).toBeGreaterThan(2);
  const id = resources[0].id;
  await commands["state.update"].run(ctx as never, {
    name: "scribble",
    changes: [{ path: ["contentById", id], value: "A saved note" }],
  });
  const result = await commands["state.read"].run(ctx as never, { name: "scribble" });
  expect(result.state).toMatchObject({ contentById: { [id]: "A saved note" } });
  const otherProject = await commands["state.read"].run(context() as never, { name: "scribble" });
  expect(otherProject.state).not.toMatchObject({ contentById: { [id]: "A saved note" } });
});
test("edits from separate panels keep each other's issue changes", async () => {
  const ctx = context();
  const first = commands["state.update"].run(ctx as never, {
    name: "zipline",
    changes: [{ path: ["statuses", "ZIP-142"], value: "Done" }],
  });
  const second = commands["state.update"].run(ctx as never, {
    name: "zipline",
    changes: [{ path: ["statuses", "ZIP-137"], value: "In progress" }],
  });
  await Promise.all([first, second]);
  expect((await commands["state.read"].run(ctx as never, { name: "zipline" })).state).toMatchObject({
    statuses: { "ZIP-142": "Done", "ZIP-137": "In progress" },
  });
});
