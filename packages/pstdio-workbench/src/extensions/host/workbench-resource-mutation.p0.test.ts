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
test("removes the declared subject when an extension acts on a host-owned resource", async () => {
  const context = setup();
  const subject = { type: "workspace", id: "one", extensionId: "pstdio", projectId: "project" };
  const remove = {
    ...command,
    resourceMutation: { kind: "remove" as const, resourceType: "workspace", idParam: "id" },
  };
  let finish!: () => void;
  const pending = runResourceMutation(
    context,
    remove,
    { id: "one" },
    { resource: subject },
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  context.workbench.commandPalette.store.getState().confirmation!.resolve(true);
  await Promise.resolve();
  expect(context.workbench.resources.preview.resolve(subject)).toBeUndefined();
  expect(context.workbench.resources.preview.resolve({ ...subject, extensionId: "another" })).toBeDefined();
  await Promise.resolve();
  await Promise.resolve();
  finish();
  await pending;
});
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

for (const kind of ["rename", "remove"] as const) {
  test(`${kind} keeps a canonical resource owned by another provider`, async () => {
    const context = setup();
    const session = { ...resource, type: "session", extensionId: "pstdio" };
    const saving = Promise.withResolvers<void>();
    const mutation =
      kind === "rename"
        ? { kind, resourceType: "session", idParam: "id", labelParam: "title" }
        : { kind, resourceType: "session", idParam: "id" };
    const pending = runResourceMutation(
      context,
      {
        id: `pstdio.pstdio-session-browser.command.${kind}`,
        extensionId: "pstdio.pstdio-session-browser",
        title: `${kind} session`,
        resourceMutation: mutation,
      },
      { id: "one", title: "New" },
      { resource: session },
      () => saving.promise,
    );
    if (kind === "remove") {
      context.workbench.commandPalette.store.getState().confirmation!.resolve(true);
      await Promise.resolve();
    }
    try {
      if (kind === "remove") expect(context.workbench.resources.preview.resolve(session)).toBeUndefined();
      else expect(context.workbench.resources.preview.resolve(session)?.label).toBe("New");
    } finally {
      saving.resolve();
      await pending;
      await context.workbench.dispose();
    }
  });
}

for (const other of [
  { ...resource, type: "session", extensionId: "pstdio" },
  { ...resource, id: "other", extensionId: "pstdio" },
  { ...resource, projectId: "another-project", extensionId: "pstdio" },
]) {
  test(`ignores unrelated execution context ${JSON.stringify(other)}`, async () => {
    const context = setup();
    const saving = Promise.withResolvers<void>();
    const pending = runResourceMutation(
      context,
      command,
      { noteId: resource.id, title: "New" },
      { resource: other },
      () => saving.promise,
    );
    try {
      expect(context.workbench.resources.preview.resolve(resource)?.label).toBe("New");
      expect(context.workbench.resources.preview.resolve(other)).toEqual(other);
    } finally {
      saving.resolve();
      await pending;
      await context.workbench.dispose();
    }
  });
}

test("canonical and provider-owned commands serialize writes on the same resource identity", async () => {
  const context = setup();
  const canonical = { ...resource, extensionId: "pstdio" };
  const first = Promise.withResolvers<void>();
  const writes: string[] = [];
  const pending = runResourceMutation(
    context,
    command,
    { noteId: resource.id, title: "First" },
    { resource: canonical },
    async () => {
      writes.push("first");
      await first.promise;
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  const next = runResourceMutation(
    context,
    { ...command, extensionId: "pstdio" },
    { noteId: resource.id, title: "Second" },
    { resource: canonical },
    async () => {
      writes.push("second");
    },
  );
  try {
    await Promise.resolve();
    await Promise.resolve();
    expect(writes).toEqual(["first"]);
  } finally {
    first.resolve();
    await Promise.all([pending, next]);
    await context.workbench.dispose();
  }
  expect(writes).toEqual(["first", "second"]);
});

test("removal confirmation names its resource and keeps failed saves available for retry", async () => {
  const context = setup();
  let writes = 0;
  const description = "Saved files are kept.";
  const pending = runResourceMutation(
    context,
    {
      ...command,
      title: "Archive note",
      description,
      resourceMutation: { kind: "remove", resourceType: "note", idParam: "noteId" },
    },
    { noteId: "one" },
    { resource },
    async () => {
      writes++;
      if (writes === 1) throw new Error("Save unavailable");
      return "saved";
    },
  );
  const confirmation = context.workbench.commandPalette.store.getState().confirmation!;
  expect(confirmation.label).toContain(resource.label);
  expect(confirmation.description).toBe(description);
  expect(confirmation.buttonLabel).toBe("Archive note");
  expect(confirmation.onConfirm).toBeFunction();
  await expect(confirmation.onConfirm!()).rejects.toThrow("Save unavailable");
  expect(context.workbench.commandPalette.store.getState().confirmation).toBe(confirmation);
  expect(context.workbench.resources.preview.resolve(resource)).toEqual(resource);
  await confirmation.onConfirm!();
  confirmation.resolve(true);
  expect(await pending).toBe("saved");
  expect(writes).toBe(2);
  await context.workbench.dispose();
});
