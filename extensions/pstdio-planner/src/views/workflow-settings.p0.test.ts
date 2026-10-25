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
  expect(result.values).toEqual({ ...selections, mergeTargetStatusId: "custom" });
  expect(result.groups?.[0]?.params[0]).toMatchObject({
    type: "selection",
    multiSelect: true,
    options: [{ id: "custom", icon: "status-done", color: "green" }],
  });
  await saveWorkflowSettings(ctx, { ...result.values, mergeTargetStatusId: "" });
  expect(settings["workflow.statuses"]).toEqual({ ...selections, mergeTargetStatusId: null });
});
