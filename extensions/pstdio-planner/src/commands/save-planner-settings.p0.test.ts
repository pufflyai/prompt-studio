import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTag, tagsCollection } from "../data/collections";
import { readTicketTags } from "../data/tag-operations";
import { putTicket, ticketsCollection } from "../data/ticket-context.fixture";
import type { StoredTag, Ticket } from "../data/types";
import { editPlannerSettings, plannerSettingsGroups, tagSettingsState } from "../views/planner-settings-model";
import { makeCommandArgs } from "./command-context.fixture";
import { savePlannerSettings } from "./save-planner-settings";

const tag: StoredTag = {
  id: "area",
  name: "Area",
  type: "multi_select",
  sortOrder: 0,
  options: [
    { id: "ui", name: "UI", color: "blue", icon: "circle", description: "Keep this description", sortOrder: 0 },
    { id: "api", name: "API", color: "green", icon: "circle", description: null, sortOrder: 1 },
  ],
};
const ticket: Ticket = {
  id: "ticket",
  shorthand: "PS-1",
  title: "Test",
  content: "",
  tags: { area: ["ui", "api"] },
  statusId: null,
  sortOrder: 0,
  archived: false,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const setup = async () => {
  const storage = createMemoryStorage();
  await putTag(storage, tag);
  await putTicket(storage, ticket);
  const state = tagSettingsState((await readTicketTags(storage)).tags);
  const save = (groups: ReturnType<typeof plannerSettingsGroups>) =>
    savePlannerSettings.run(
      ...makeCommandArgs({
        storage,
        params: { kind: "tags", changes: editPlannerSettings(state, groups) },
      }),
    );
  return { storage, state: { groups: plannerSettingsGroups(state) }, save };
};
test("saving a tag collection preserves identities and descriptions and removes deleted ticket values", async () => {
  const { storage, state, save } = await setup();
  const groups = state.groups.map((group) =>
    group.id === "area"
      ? {
          ...group,
          name: "Team",
          values: [group.values[0], { id: "new-option", name: "New", color: "red", sortOrder: 1 }],
        }
      : group,
  );
  await save(groups);
  await save(groups);
  const saved = await tagsCollection(storage).get("area");
  expect(saved?.name).toBe("Team");
  expect(saved?.options.map((option) => option.id)).toEqual(["ui", "new-option"]);
  expect(saved?.options[0].description).toBe("Keep this description");
  expect((await ticketsCollection(storage).get("ticket"))?.tags?.area).toEqual(["ui"]);
});
test("a conflicting selection-mode change rejects the whole collection before deleting any tag", async () => {
  const { storage, state, save } = await setup();
  await putTag(storage, { ...tag, id: "keep", name: "Keep" });
  await expect(
    save(state.groups.map((group) => (group.id === "area" ? { ...group, type: "single_select" } : group))),
  ).rejects.toThrow("PS-1");
  expect((await tagsCollection(storage).get("area"))?.type).toBe("multi_select");
  expect(await tagsCollection(storage).get("keep")).toBeDefined();
  expect((await ticketsCollection(storage).get("ticket"))?.tags?.area).toEqual(["ui", "api"]);
});

test("deleting an assigned option allows the same draft to switch to single-select", async () => {
  const { storage, state, save } = await setup();
  await save(
    state.groups.map((group) =>
      group.id === "area" ? { ...group, type: "single_select", values: [group.values[0]] } : group,
    ),
  );
  expect((await tagsCollection(storage).get("area"))?.type).toBe("single_select");
  expect((await ticketsCollection(storage).get("ticket"))?.tags?.area).toBe("ui");
});

test("saving a local rename preserves tags and option edits created concurrently", async () => {
  const { storage, state, save } = await setup();
  const local = state.groups.map((group) => (group.id === "area" ? { ...group, name: "Team" } : group));
  await putTag(storage, { ...tag, id: "concurrent", name: "Added elsewhere" });
  await putTag(storage, { ...tag, options: tag.options.map((option) => ({ ...option, color: "red" })) });
  await save(local);
  expect(await tagsCollection(storage).get("concurrent")).toBeDefined();
  expect((await tagsCollection(storage).get("area"))?.options[0].color).toBe("red");
  expect((await tagsCollection(storage).get("area"))?.name).toBe("Team");
});
test("an edited tag removed elsewhere is never recreated by a stale draft", async () => {
  const { storage, state, save } = await setup();
  const local = state.groups.map((group) => ({ ...group, name: "Renamed" }));
  await tagsCollection(storage).delete("area");
  await expect(save(local)).rejects.toThrow("removed elsewhere");
  expect(await tagsCollection(storage).get("area")).toBeUndefined();
});

test("concurrent default status changes still leave exactly the locally selected default", async () => {
  const { readStatusSettings, saveStatusSettings } = await import("../ticket-status-settings");
  const { statusSettingsState } = await import("../views/planner-settings-model");
  const storage = createMemoryStorage();
  const { statuses } = await readStatusSettings.run(...makeCommandArgs({ storage, params: {} }));
  const state = statusSettingsState(statuses);
  const selected = statuses[1].id;
  const concurrent = statuses[2].id;
  const groups = plannerSettingsGroups(state).map((group) => ({
    ...group,
    values: group.values.map((value) => ({ ...value, isDefault: value.id === selected })),
  }));
  const changes = editPlannerSettings(state, groups);
  await saveStatusSettings.run(
    ...makeCommandArgs({
      storage,
      params: { statuses: statuses.map((status) => ({ ...status, isDefault: status.id === concurrent })) },
    }),
  );
  await savePlannerSettings.run(...makeCommandArgs({ storage, params: { kind: "status", changes } }));
  const saved = await readStatusSettings.run(...makeCommandArgs({ storage, params: {} }));
  expect(saved.statuses.filter((status) => status.isDefault).map((status) => status.id)).toEqual([selected]);
});

test("a default status deleted elsewhere is rejected instead of clearing the remaining default", async () => {
  const { readStatusSettings, saveStatusSettings } = await import("../ticket-status-settings");
  const { statusSettingsState } = await import("../views/planner-settings-model");
  const storage = createMemoryStorage();
  const { statuses } = await readStatusSettings.run(...makeCommandArgs({ storage, params: {} }));
  const state = statusSettingsState(statuses);
  const selected = statuses[1].id;
  const groups = plannerSettingsGroups(state).map((group) => ({
    ...group,
    values: group.values.map((value) => ({ ...value, isDefault: value.id === selected })),
  }));
  const changes = editPlannerSettings(state, groups);
  await saveStatusSettings.run(
    ...makeCommandArgs({ storage, params: { statuses: statuses.filter((status) => status.id !== selected) } }),
  );
  await expect(
    savePlannerSettings.run(...makeCommandArgs({ storage, params: { kind: "status", changes } })),
  ).rejects.toThrow("removed elsewhere");
  const saved = await readStatusSettings.run(...makeCommandArgs({ storage, params: {} }));
  expect(saved.statuses.filter((status) => status.isDefault)).toHaveLength(1);
});
