import { expect, test } from "bun:test";
import { commandRef } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostAdapters } from "./webview-host-capabilities";

const setup = () => {
  const workbench = createWorkbench();
  const calls: unknown[] = [];
  workbench.commands.registerCommand(
    {
      id: "planner.command.select-model",
      label: "Supervisor model",
      params: { supervisorModel: { type: "harness", required: true } },
    },
    { execute: (input) => calls.push(input) },
  );
  const host = createWorkbenchWebviewHostAdapters({ workbench, extensionId: "planner" });
  return { workbench, host, calls };
};

test("command navigation collects missing required inputs before executing", async () => {
  const { workbench, host, calls } = setup();
  await host.navigation.open({
    kind: "command",
    target: { command: commandRef({ extensionId: "planner", id: "select-model" }) },
  });
  expect(calls).toHaveLength(0);
  expect(workbench.commandPalette.store.getState().paramsRequest).toMatchObject({
    label: "Supervisor model",
    record: { command: { id: "planner.command.select-model" } },
  });
});

test("command navigation executes supplied required inputs directly", async () => {
  const { workbench, host, calls } = setup();
  const params = { supervisorModel: { harnessId: "codex", model: "selected-model" } };
  await host.navigation.open({
    kind: "command",
    target: { command: commandRef({ extensionId: "planner", id: "select-model" }), params },
  });
  expect(calls).toEqual([params]);
  expect(workbench.commandPalette.store.getState().paramsRequest).toBeNull();
});
