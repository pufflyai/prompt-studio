import { expect, test } from "bun:test";
import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

const command = {
  id: "files.command.delete-entry",
  extensionId: "files",
  title: "Delete entry",
  confirmation: {
    kind: "delete" as const,
    subjectParam: "path",
    confirmedParam: "confirmed",
    description: "The entry and its contents will be permanently removed.",
    buttonLabel: "Delete",
  },
};

test("native command confirmation names the file and sends explicit consent only after confirmation", async () => {
  const workbench = createWorkbench();
  const requests: CommandExecuteRequest[] = [];
  const context = {
    workbench,
    projectId: "project",
    metadata: { commands: [command] },
    executeCommand: (_id: string, body: CommandExecuteRequest) => {
      requests.push(body);
      return { outcome: { status: "success", ok: true, value: "deleted" } };
    },
  };
  const input = { resource: { type: "workspace", id: "one" }, params: { path: "src/deep/file.md" } };
  const cancelled = executeWorkbenchExtensionCommand(context, command.id, input);
  expect(requests).toEqual([]);
  const dialog = workbench.commandPalette.store.getState().confirmation!;
  expect(dialog).toMatchObject({ label: "Delete entry: src/deep/file.md", buttonLabel: "Delete" });
  dialog.resolve(false);
  await cancelled;
  expect(requests).toEqual([]);
  const accepted = executeWorkbenchExtensionCommand(context, command.id, input);
  const confirmation = workbench.commandPalette.store.getState().confirmation!;
  await confirmation.onConfirm!();
  confirmation.resolve(true);
  expect(await accepted).toBe("deleted");
  expect(requests).toHaveLength(1);
  expect(requests[0]?.params).toEqual({ path: "src/deep/file.md", confirmed: true });
  expect(input.params).toEqual({ path: "src/deep/file.md" });
  await workbench.dispose();
});

test("a failed confirmed command stays in the host dialog and can retry the same file", async () => {
  const workbench = createWorkbench();
  let attempts = 0;
  const pending = executeWorkbenchExtensionCommand(
    {
      workbench,
      projectId: "project",
      metadata: { commands: [command] },
      executeCommand: () => {
        if (++attempts === 1) throw new Error("Permission denied");
        return { outcome: { status: "success", ok: true, value: "deleted" } };
      },
    },
    command.id,
    { params: { path: "file.md" } },
  );
  const dialog = workbench.commandPalette.store.getState().confirmation!;
  await expect(dialog.onConfirm!()).rejects.toThrow("Permission denied");
  expect(workbench.commandPalette.store.getState().confirmation).toBe(dialog);
  await dialog.onConfirm!();
  dialog.resolve(true);
  expect(await pending).toBe("deleted");
  expect(attempts).toBe(2);
  await workbench.dispose();
});

test("aborting a pending command dismisses its owned host confirmation without executing", async () => {
  const workbench = createWorkbench();
  const controller = new AbortController();
  let writes = 0;
  const pending = executeWorkbenchExtensionCommand(
    {
      workbench,
      projectId: "project",
      metadata: { commands: [command] },
      executeCommand: () => {
        writes++;
        return {};
      },
    },
    command.id,
    { params: { path: "file.md" }, signal: controller.signal },
  );
  try {
    controller.abort();
    expect(workbench.commandPalette.store.getState().confirmation).toBeNull();
    expect(await pending).toBeUndefined();
    expect(writes).toBe(0);
  } finally {
    workbench.commandPalette.store.getState().confirmation?.resolve(false);
    await pending;
    await workbench.dispose();
  }
});
