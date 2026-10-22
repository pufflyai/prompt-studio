import { expect, test } from "bun:test";
import { createWorkbench, resourceContextMenuPath } from "../../core";
import { createWorkbenchResourceMenu } from "./resource-menu";

test.each([
  { args: undefined, expected: { noteId: "note-1" } },
  { args: { permanent: true }, expected: { noteId: "note-1", permanent: true } },
  { args: { noteId: "explicit" }, expected: { noteId: "explicit" } },
])("direct resource actions resolve bound parameters and preserve explicit arguments: $args", async ({
  args,
  expected,
}) => {
  const workbench = createWorkbench();
  let received: unknown;
  workbench.commands.registerCommand(
    { id: "delete", label: "Delete", params: { noteId: { type: "text", resolvedFrom: "resource" } } },
    {
      execute: (args) => {
        received = args;
      },
    },
  );
  workbench.layout.registerMenuItem(resourceContextMenuPath("note"), { commandId: "delete", args });
  const actions = createWorkbenchResourceMenu(workbench, { type: "note", id: "note-1" }, {});
  await actions[0]?.onClick?.();
  expect(received).toEqual(expected);
});

test("resource menus include the subject's actions before independent custom sections", async () => {
  const workbench = createWorkbench();
  const subject = { type: "document", id: "b", extensionId: "notes", label: "B" };
  let executed: unknown;
  workbench.resources.registerKind({ kind: "document", label: "Document" });
  workbench.commands.registerCommand(
    { id: "rename", label: "Rename" },
    {
      execute: (_, ctx) => {
        executed = ctx?.resource;
      },
    },
  );
  workbench.layout.registerMenuItem(resourceContextMenuPath("document"), { id: "notes:rename", commandId: "rename" });
  const actions = createWorkbenchResourceMenu(workbench, subject, {
    menu: [
      {
        id: "quick",
        label: "Quick access",
        rows: [{ id: "new", label: "New", action: { kind: "command", commandId: "new" } }],
      },
    ],
  });
  expect(actions.map((action) => action.label)).toEqual(["Rename", "New"]);
  expect(actions[0]?.group?.label).toBe("Document");
  expect(actions[1]?.group?.label).toBe("Quick access");
  await actions[0]?.onClick?.();
  expect(executed).toEqual(subject);
});

test("resource menu identities remain stable when earlier contributions change", () => {
  const workbench = createWorkbench();
  const subject = { type: "note", id: "a" };
  workbench.commands.registerCommand({ id: "same", label: "Run" }, { execute() {} });
  workbench.layout.registerMenuItem(resourceContextMenuPath("note"), {
    id: "export:pdf",
    commandId: "same",
    args: { format: "pdf" },
  });
  workbench.layout.registerMenuItem(resourceContextMenuPath("note"), {
    id: "export:text",
    commandId: "same",
    args: { format: "text" },
  });
  const before = createWorkbenchResourceMenu(workbench, subject, {});
  const preceding = workbench.layout.registerMenuItem(resourceContextMenuPath("note"), {
    id: "first",
    commandId: "same",
    order: -1,
  });
  const after = createWorkbenchResourceMenu(workbench, subject, {});
  expect(after.slice(1).map((action) => action.key)).toEqual(before.map((action) => action.key));
  expect(new Set(after.map((action) => action.key)).size).toBe(3);
  preceding.dispose();
});

test("resource kinds and menu contributions stay scoped to their owner", () => {
  const workbench = createWorkbench();
  for (const owner of ["first", "second"]) {
    workbench.resources.registerKind({ kind: "document", extensionId: owner, label: `${owner} document` });
    workbench.commands.registerCommand({ id: owner, label: `Export ${owner}` }, { execute() {} });
    workbench.layout.registerMenuItem(resourceContextMenuPath("document"), {
      commandId: owner,
      when: `workbench.resource.extensionId == "${owner}"`,
    });
  }
  for (const owner of ["first", "second"]) {
    const actions = createWorkbenchResourceMenu(workbench, { type: "document", id: "one", extensionId: owner }, {});
    expect(actions.map((action) => action.label)).toEqual([`Export ${owner}`]);
    expect(actions[0]?.group?.label).toBe(`${owner} document`);
  }
});
