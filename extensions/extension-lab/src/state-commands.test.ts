import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readExampleState, writeExampleState } from "./example-state";
import { commands } from "./state-commands";

const context = () => ({ storage: createMemoryStorage(), events: { emit: async () => ({ delivered: 0 }) } });
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

test("replacing a parent removes older saved child edits", async () => {
  const ctx = context();
  await commands["state.update"].run(ctx as never, {
    name: "pigeon",
    changes: [{ path: ["draft", "subject"], value: "Old subject" }],
  });
  await commands["state.update"].run(ctx as never, {
    name: "pigeon",
    changes: [{ path: ["draft"], value: { to: "", subject: "", body: "" } }],
  });
  expect((await commands["state.read"].run(ctx as never, { name: "pigeon" })).state).toMatchObject({
    draft: { to: "", subject: "", body: "" },
  });
});

test("existing saved fields migrate once into grouped records", async () => {
  const storage = createMemoryStorage();
  const legacy = storage.collection("examples:pigeon");
  await legacy.put(JSON.stringify(["draft", "subject"]), { path: ["draft", "subject"], value: "Existing draft" });
  expect((await readExampleState(storage, "pigeon")).draft.subject).toBe("Existing draft");
  expect(await legacy.list()).toEqual([]);
  expect((await readExampleState(storage, "pigeon")).draft.subject).toBe("Existing draft");
});

test("a failed grouped replacement retains all previously saved fields", async () => {
  const storage = createMemoryStorage();
  await writeExampleState(storage, "pigeon", [{ path: ["draft", "subject"], value: "Previously saved subject" }]);
  const failing = {
    ...storage,
    records: {
      ...storage.records,
      commit: async () => {
        throw new Error("Storage unavailable");
      },
    },
  };
  await expect(
    writeExampleState(failing, "pigeon", [{ path: ["draft"], value: { to: "", subject: "Replacement", body: "" } }]),
  ).rejects.toThrow("Storage unavailable");
  expect((await readExampleState(storage, "pigeon")).draft.subject).toBe("Previously saved subject");
});

test("migration resumes cleanup after a failed legacy delete without recopying saved records", async () => {
  const storage = createMemoryStorage();
  const legacy = storage.collection("examples:pigeon");
  await legacy.put(JSON.stringify(["draft", "subject"]), { path: ["draft", "subject"], value: "Existing subject" });
  await legacy.put(JSON.stringify(["draft", "to"]), { path: ["draft", "to"], value: "alex@example.com" });
  let deletes = 0;
  const failing = {
    ...storage,
    collection: <Item>(name: string) => {
      const collection = storage.collection<Item>(name);
      return {
        ...collection,
        delete: async (key: string) => {
          if (++deletes === 2) throw new Error("Cleanup unavailable");
          await collection.delete(key);
        },
      };
    },
  };
  await expect(readExampleState(failing, "pigeon")).rejects.toThrow("Cleanup unavailable");
  expect((await readExampleState(storage, "pigeon")).draft).toMatchObject({
    subject: "Existing subject",
    to: "alex@example.com",
  });
  expect(await legacy.list()).toEqual([]);
});

test("concurrent parent and child edits always leave a readable document", async () => {
  const ctx = context();
  const results = await Promise.allSettled([
    writeExampleState(ctx.storage, "pigeon", [{ path: ["draft"], value: null }]),
    writeExampleState(ctx.storage, "pigeon", [{ path: ["draft", "subject"], value: "Concurrent child" }]),
  ]);
  expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
  expect((await readExampleState(ctx.storage, "pigeon")).draft).toBeNull();
});
