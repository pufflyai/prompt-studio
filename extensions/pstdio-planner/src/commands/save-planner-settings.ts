import { applyEditingChanges, defineCommand, params, type WebviewEditingChange } from "@pstdio/sdk/extensions";
import { putTag, tagsCollection } from "../data/collections";
import { assertSingleSelectConversion, editTicketTagValues } from "../data/tag-cardinality";
import { readTicketTags } from "../data/tag-operations";
import { tagValue, tagValueIds } from "../data/ticket-tags";
import { plannerSchemaChanged, plannerTicketsChanged } from "../events";
import { readStatusSettings, saveStatusSettings } from "../ticket-status-settings";
import {
  assertPlannerSettingsState,
  plannerSettingsGroups,
  statusSettingsState,
  tagSettingsState,
} from "../views/planner-settings-model";

export const savePlannerSettings = defineCommand({
  id: "settings.save-collections",
  title: "Save Planner settings",
  mutating: true,
  params: {
    kind: params.text({ required: true }),
    changes: { ...params.json<WebviewEditingChange[]>(), required: true },
  },
  async run(ctx, input) {
    if (input.kind === "status") {
      const current = await readStatusSettings.run(ctx, {});
      const next = applyEditingChanges(statusSettingsState(current.statuses), input.changes);
      assertPlannerSettingsState(next);
      return saveStatusSettings.run(ctx, {
        statuses: plannerSettingsGroups(next)[0].values.map(({ name, ...value }) => ({ ...value, label: name })),
      });
    }
    if (input.kind !== "tags") throw new Error("Unknown Planner settings page");
    const { tags } = await readTicketTags(ctx.storage);
    const next = applyEditingChanges(tagSettingsState(tags), input.changes);
    assertPlannerSettingsState(next);
    const previous = new Map(tags.map((tag) => [tag.id, tag]));
    const records = plannerSettingsGroups(next).map((group, sortOrder) => ({
      id: group.id,
      name: group.name,
      type: group.type ?? ("single_select" as const),
      sortOrder: group.sortOrder ?? sortOrder,
      options: group.values.map((value, index) => ({
        id: value.id,
        name: value.name,
        color: value.color,
        icon: value.icon ?? null,
        sortOrder: index,
        description: previous.get(group.id)?.options.find((option) => option.id === value.id)?.description ?? null,
      })),
    }));
    for (const record of records) {
      if (!record.id || !record.name || !record.options.every((option) => option.id && option.name && option.color))
        throw new Error("A tag or option was removed elsewhere. Reset changes and try again.");
    }
    // Validate every selection-mode change before modifying definitions or ticket assignments.
    for (const record of records) {
      const stored = previous.get(record.id);
      if (stored) await assertSingleSelectConversion(ctx, { ...stored, options: record.options }, record.type);
    }
    for (const stored of tags) {
      const record = records.find((tag) => tag.id === stored.id);
      if (!record) {
        await editTicketTagValues(ctx.storage, stored.id, () => undefined);
        await tagsCollection(ctx.storage).delete(stored.id);
      }
    }
    for (const record of records) {
      await putTag(ctx.storage, record);
      const allowed = new Set(record.options.map((option) => option.id));
      await editTicketTagValues(ctx.storage, record.id, (value) =>
        tagValue(
          record,
          tagValueIds(value).filter((id) => allowed.has(id)),
          value,
        ),
      );
    }
    await ctx.events.emit(plannerTicketsChanged, {});
    await ctx.events.emit(plannerSchemaChanged, {});
  },
});
