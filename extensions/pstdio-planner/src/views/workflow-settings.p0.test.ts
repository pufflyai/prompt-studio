import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { statusesCollection } from "../data/collections";
import { emptyWorkflowStatuses } from "../data/workflow-statuses";
import { queryWorkflowSettings, saveWorkflowSettings } from "./workflow-settings";

test("native workflow controls expose current status IDs, icons, colors, and saved selections", async () => {
  const storage = createMemoryStorage();
  const selections = { ...emptyWorkflowStatuses(), completedStatusIds: ["custom"], mergeTargetStatusId: "custom" };
  const settings: Record<string, unknown> = { "workflow.statuses": selections };
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      settings: {
        all: async () => settings,
        set: async (key, value) => {
          settings[key] = value;
        },
      },
    },
  });
  await statusesCollection(storage).put("custom", {
    id: "custom",
    name: "Delivered",
    sortOrder: 0,
    icon: "status-done",
    color: "green",
  } as never);
  const result = await queryWorkflowSettings(ctx);
  expect(result.values).toMatchObject({ ...selections, mergeTargetStatusId: "custom" });
  expect(result.groups?.find((group) => group.id === "workflow")?.params[0]).toMatchObject({
    type: "selection",
    multiSelect: true,
    options: [{ id: "custom", icon: "status-done", color: "green" }],
  });
  await saveWorkflowSettings(ctx, { ...result.values, mergeTargetStatusId: "" });
  expect(settings["implementation.adversarialReview"]).toBe(true);
  expect(settings["automation.maxInProgress"]).toBe(2);
  expect(settings["workflow.statuses"]).toEqual({ ...selections, mergeTargetStatusId: null });
});

test("workflow settings offer project branches and retain a configured branch that is no longer fetched", async () => {
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      settings: { all: async () => ({ "implementation.defaultTargetBranch": "origin/old-release" }) },
      process: {
        run: async () => ({ exitCode: 0, stdout: "true", stderr: "" }),
        runOrThrow: async () => ({
          exitCode: 0,
          stdout: "origin/main\t\norigin/release\t\norigin/HEAD\trefs/remotes/origin/main\n",
          stderr: "",
        }),
      },
    },
  });
  const result = await queryWorkflowSettings(ctx);
  expect(result.groups?.[0]?.id).toBe("automation");
  const branch = result.groups
    ?.flatMap((group) => group.params)
    .find((param) => param.id === "implementation.defaultTargetBranch");
  expect(branch).toMatchObject({
    type: "selection",
    defaultValue: "origin/old-release",
    options: [
      { id: "origin/main", name: "origin/main" },
      { id: "origin/release", name: "origin/release" },
      { id: "origin/old-release", name: "origin/old-release (unavailable)" },
    ],
  });
});
