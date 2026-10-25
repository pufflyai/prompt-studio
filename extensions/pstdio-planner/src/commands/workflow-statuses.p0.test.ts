import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { statusesCollection } from "../data/collections";
import { emptyWorkflowStatuses } from "../data/workflow-statuses";
import { makeCommandContext } from "./command-context.fixture";
import { readWorkflowStatusesCommand, saveWorkflowStatusesCommand } from "./workflow-statuses";

const setup = async () => {
  const storage = createMemoryStorage();
  const settings: Record<string, unknown> = {};
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
  await statusesCollection(storage).put("custom", { id: "custom", name: "Delivered", sortOrder: 0 } as never);
  return { ctx, storage, settings };
};
test("arbitrary ID selections survive rename, reorder, and report a deleted choice", async () => {
  const { ctx, storage } = await setup();
  const selections = { ...emptyWorkflowStatuses(), completedStatusIds: ["custom"], mergeTargetStatusId: "custom" };
  await saveWorkflowStatusesCommand.run(ctx, { selections });
  await statusesCollection(storage).put("custom", { id: "custom", name: "Anything", sortOrder: 19 } as never);
  expect(await readWorkflowStatusesCommand.run(ctx, {})).toMatchObject({
    selections,
    missingStatusIds: [],
    statuses: [{ name: "Anything" }],
  });
  await statusesCollection(storage).delete("custom");
  expect(await readWorkflowStatusesCommand.run(ctx, {})).toMatchObject({ selections, missingStatusIds: ["custom"] });
});
test("empty configuration assigns no meaning to a Done label and invalid saves preserve settings", async () => {
  const { ctx, storage, settings } = await setup();
  await statusesCollection(storage).put("custom", { id: "custom", name: "Done", sortOrder: 0 } as never);
  expect((await readWorkflowStatusesCommand.run(ctx, {})).selections).toEqual(emptyWorkflowStatuses());
  const invalid = { ...emptyWorkflowStatuses(), completedStatusIds: ["custom"], blockedStatusIds: ["custom"] };
  await expect(saveWorkflowStatusesCommand.run(ctx, { selections: invalid })).rejects.toThrow("overlap");
  await expect(
    saveWorkflowStatusesCommand.run(ctx, { selections: { ...emptyWorkflowStatuses(), mergeTargetStatusId: "custom" } }),
  ).rejects.toThrow("completed");
  expect(settings).toEqual({});
});
