import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { runResourceMutation } from "./workbench-resource-mutation";

const resource = { type: "note", id: "one", extensionId: "notes", projectId: "project", label: "Old" };
const command = {
  id: "notes.command.rename",
  extensionId: "notes",
  title: "Rename note",
  resourceMutation: { kind: "rename" as const, resourceType: "note", idParam: "noteId", labelParam: "title" },
};
const setup = () => ({ projectId: "project", workbench: createWorkbench(), executeCommand: () => undefined });
test("renames immediately, then restores the previous label on command failure", async () => {
  const context = setup();
  let reject!: (error: Error) => void;
  const pending = runResourceMutation(
    context,
    command,
    { noteId: "one", title: "New" },
    undefined,
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  expect(context.workbench.resources.preview.resolve(resource)?.label).toBe("New");
  await Promise.resolve();
  await Promise.resolve();
  reject(new Error("Save failed"));
  await expect(pending).rejects.toThrow("Save failed");
  expect(context.workbench.resources.preview.resolve(resource)?.label).toBe("Old");
});
test("does not remove a resource or call the server before confirmation, and cancels safely", async () => {
  const context = setup();
  let writes = 0;
  const remove = {
    ...command,
    title: "Delete note",
    resourceMutation: { kind: "remove" as const, resourceType: "note", idParam: "noteId" },
  };
  const pending = runResourceMutation(context, remove, { noteId: "one" }, undefined, async () => {
    writes++;
  });
  expect(writes).toBe(0);
  expect(context.workbench.resources.preview.resolve(resource)).toEqual(resource);
  context.workbench.commandPalette.store.getState().confirmation!.resolve(false);
  await pending;
  expect(writes).toBe(0);
  expect(context.workbench.resources.preview.resolve(resource)).toEqual(resource);
});
test("removes immediately after confirmation and restores the resource after failure", async () => {
  const context = setup();
  let reject!: (error: Error) => void;
  const remove = {
    ...command,
    title: "Delete note",
    resourceMutation: { kind: "remove" as const, resourceType: "note", idParam: "noteId" },
  };
  const pending = runResourceMutation(
    context,
    remove,
    { noteId: "one" },
    undefined,
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  context.workbench.commandPalette.store.getState().confirmation!.resolve(true);
  await Promise.resolve();
  expect(context.workbench.resources.preview.resolve(resource)).toBeUndefined();
  await Promise.resolve();
  await Promise.resolve();
  reject(new Error("Remove failed"));
  await expect(pending).rejects.toThrow("Remove failed");
  expect(context.workbench.resources.preview.resolve(resource)).toEqual(resource);
});
