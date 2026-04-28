import type { CommandDefinition, CommandRunContext } from "@pstdio/sdk/extensions";
import {
  idFromName,
  numberParam,
  optionalBooleanParam,
  readPlannerStatuses,
  readPlannerTagOptions,
  readPlannerTags,
  type StoredPlannerStatus,
  type StoredPlannerTag,
  type StoredPlannerTagOption,
  setOnlyDefaultStatus,
  stringArrayParam,
  stringParam,
  writePlannerStatus,
} from "./shared";

export const metadataCommands = {
  listStatuses: {
    title: "List planner ticket statuses",
    target: "project",
    async run(ctx: CommandRunContext) {
      return readPlannerStatuses(ctx);
    },
  },
  createStatus: {
    title: "Create planner ticket status",
    target: "project",
    async run(ctx: CommandRunContext) {
      const name = stringParam(ctx, "name");
      if (!name) throw new Error("Status name is required.");

      const statuses = await readPlannerStatuses(ctx);
      if (statuses.some((status) => status.name === name)) throw new Error(`Status already exists: ${name}`);

      const status: StoredPlannerStatus = {
        id: stringParam(ctx, "id") ?? (idFromName(name) || crypto.randomUUID()),
        name,
        color: stringParam(ctx, "color") ?? "gray",
        sortOrder: numberParam(ctx, "sort_order") ?? numberParam(ctx, "sortOrder") ?? statuses.length + 1,
        isDefault: optionalBooleanParam(ctx, "is_default") ?? optionalBooleanParam(ctx, "isDefault") ?? false,
        canDragOut: optionalBooleanParam(ctx, "can_drag_out") ?? optionalBooleanParam(ctx, "canDragOut") ?? true,
        canDragIn: optionalBooleanParam(ctx, "can_drag_in") ?? optionalBooleanParam(ctx, "canDragIn") ?? true,
        canCreate: optionalBooleanParam(ctx, "can_create") ?? optionalBooleanParam(ctx, "canCreate") ?? false,
        columnActions: stringArrayParam(ctx, "column_actions") ?? stringArrayParam(ctx, "columnActions") ?? [],
      };

      await writePlannerStatus(ctx, status);
      if (status.isDefault) await setOnlyDefaultStatus(ctx, status.id);
      return status;
    },
  },
  updateStatus: {
    title: "Update planner ticket status",
    target: "project",
    async run(ctx: CommandRunContext) {
      const statusId = stringParam(ctx, "status_id") ?? stringParam(ctx, "statusId") ?? stringParam(ctx, "id");
      if (!statusId) throw new Error("Status id is required.");

      const statuses = await readPlannerStatuses(ctx);
      const existing = statuses.find((status) => status.id === statusId);
      if (!existing) throw new Error(`Status not found: ${statusId}`);

      const updated: StoredPlannerStatus = {
        ...existing,
        name: stringParam(ctx, "name") ?? existing.name,
        color: stringParam(ctx, "color") ?? existing.color,
        sortOrder: numberParam(ctx, "sort_order") ?? numberParam(ctx, "sortOrder") ?? existing.sortOrder,
        isDefault:
          optionalBooleanParam(ctx, "is_default") ?? optionalBooleanParam(ctx, "isDefault") ?? existing.isDefault,
        canDragOut:
          optionalBooleanParam(ctx, "can_drag_out") ?? optionalBooleanParam(ctx, "canDragOut") ?? existing.canDragOut,
        canDragIn:
          optionalBooleanParam(ctx, "can_drag_in") ?? optionalBooleanParam(ctx, "canDragIn") ?? existing.canDragIn,
        canCreate:
          optionalBooleanParam(ctx, "can_create") ?? optionalBooleanParam(ctx, "canCreate") ?? existing.canCreate,
        columnActions:
          stringArrayParam(ctx, "column_actions") ?? stringArrayParam(ctx, "columnActions") ?? existing.columnActions,
      };

      await writePlannerStatus(ctx, updated);
      if (updated.isDefault) await setOnlyDefaultStatus(ctx, updated.id);
      return updated;
    },
  },
  setDefaultStatus: {
    title: "Set default planner ticket status",
    target: "project",
    async run(ctx: CommandRunContext) {
      const statusId = stringParam(ctx, "status_id") ?? stringParam(ctx, "statusId") ?? stringParam(ctx, "id");
      if (!statusId) throw new Error("Status id is required.");

      const statuses = await readPlannerStatuses(ctx);
      const status = statuses.find((candidate) => candidate.id === statusId);
      if (!status) throw new Error(`Status not found: ${statusId}`);

      await setOnlyDefaultStatus(ctx, status.id);
      return { statusId: status.id };
    },
  },
  deleteStatus: {
    title: "Delete planner ticket status",
    target: "project",
    async run(ctx: CommandRunContext) {
      const statusId = stringParam(ctx, "status_id") ?? stringParam(ctx, "statusId") ?? stringParam(ctx, "id");
      if (!statusId) throw new Error("Status id is required.");

      const statuses = await readPlannerStatuses(ctx);
      const status = statuses.find((candidate) => candidate.id === statusId);
      if (!status) throw new Error(`Status not found: ${statusId}`);
      if (status.isDefault) throw new Error(`Cannot delete the default status "${status.name}".`);

      await ctx.storage.collection("statuses").delete(status.id);
      return { statusId: status.id, deleted: true };
    },
  },
  listTags: {
    title: "List planner ticket tags",
    target: "project",
    async run(ctx: CommandRunContext) {
      return readPlannerTags(ctx);
    },
  },
  createTag: {
    title: "Create planner ticket tag",
    target: "project",
    async run(ctx: CommandRunContext) {
      const name = stringParam(ctx, "name");
      if (!name) throw new Error("Tag name is required.");

      const tags = await readPlannerTags(ctx);
      if (tags.some((tag) => tag.name === name)) throw new Error(`Tag already exists: ${name}`);

      const tag: StoredPlannerTag = {
        id: stringParam(ctx, "id") ?? (idFromName(name) || crypto.randomUUID()),
        name,
        type:
          stringParam(ctx, "type") === "multi_select" || stringParam(ctx, "type") === "single_select"
            ? (stringParam(ctx, "type") as "single_select" | "multi_select")
            : "single_select",
      };

      await ctx.storage.collection("tags").put(tag.id, tag);
      return { ...tag, options: [] };
    },
  },
  updateTag: {
    title: "Update planner ticket tag",
    target: "project",
    async run(ctx: CommandRunContext) {
      const tagId = stringParam(ctx, "tag_id") ?? stringParam(ctx, "tagId") ?? stringParam(ctx, "id");
      if (!tagId) throw new Error("Tag id is required.");

      const tags = (await readPlannerTags(ctx)) as Array<StoredPlannerTag & { options: StoredPlannerTagOption[] }>;
      const existing = tags.find((tag) => tag.id === tagId);
      if (!existing) throw new Error(`Tag not found: ${tagId}`);

      const type = stringParam(ctx, "type");
      const updated: StoredPlannerTag = {
        id: existing.id,
        name: stringParam(ctx, "name") ?? existing.name,
        type: type === "multi_select" || type === "single_select" ? type : existing.type,
      };

      await ctx.storage.collection("tags").put(updated.id, updated);
      return { ...updated, options: existing.options };
    },
  },
  deleteTag: {
    title: "Delete planner ticket tag",
    target: "project",
    async run(ctx: CommandRunContext) {
      const tagId = stringParam(ctx, "tag_id") ?? stringParam(ctx, "tagId") ?? stringParam(ctx, "id");
      if (!tagId) throw new Error("Tag id is required.");

      const tags = await readPlannerTags(ctx);
      if (!tags.some((tag) => tag.id === tagId)) throw new Error(`Tag not found: ${tagId}`);

      await ctx.storage.collection("tags").delete(tagId);
      for (const option of (await readPlannerTagOptions(ctx)).filter((candidate) => candidate.tagId === tagId)) {
        await ctx.storage.collection("tag_options").delete(option.id);
      }

      return { tagId, deleted: true };
    },
  },
  createTagOption: {
    title: "Create planner ticket tag option",
    target: "project",
    async run(ctx: CommandRunContext) {
      const tagId = stringParam(ctx, "tag_id") ?? stringParam(ctx, "tagId");
      const name = stringParam(ctx, "name");
      if (!tagId) throw new Error("Tag id is required.");
      if (!name) throw new Error("Tag option name is required.");

      const tags = await readPlannerTags(ctx);
      if (!tags.some((tag) => tag.id === tagId)) throw new Error(`Tag not found: ${tagId}`);

      const options = (await readPlannerTagOptions(ctx)).filter((option) => option.tagId === tagId);
      if (options.some((option) => option.name === name)) throw new Error(`Tag option already exists: ${name}`);

      const option: StoredPlannerTagOption = {
        id: stringParam(ctx, "id") ?? (idFromName(name) || crypto.randomUUID()),
        tagId,
        name,
        color: stringParam(ctx, "color") ?? "gray",
        sortOrder: numberParam(ctx, "sort_order") ?? numberParam(ctx, "sortOrder") ?? options.length + 1,
        icon: stringParam(ctx, "icon") ?? null,
        description: stringParam(ctx, "description") ?? null,
      };

      await ctx.storage.collection("tag_options").put(option.id, option);
      return option;
    },
  },
  updateTagOption: {
    title: "Update planner ticket tag option",
    target: "project",
    async run(ctx: CommandRunContext) {
      const optionId = stringParam(ctx, "option_id") ?? stringParam(ctx, "optionId") ?? stringParam(ctx, "id");
      if (!optionId) throw new Error("Tag option id is required.");

      const existing = (await readPlannerTagOptions(ctx)).find((option) => option.id === optionId);
      if (!existing) throw new Error(`Tag option not found: ${optionId}`);

      const updated: StoredPlannerTagOption = {
        ...existing,
        name: stringParam(ctx, "name") ?? existing.name,
        color: stringParam(ctx, "color") ?? existing.color,
        sortOrder: numberParam(ctx, "sort_order") ?? numberParam(ctx, "sortOrder") ?? existing.sortOrder,
        icon: ctx.params.icon === null ? null : (stringParam(ctx, "icon") ?? existing.icon),
        description: ctx.params.description === null ? null : (stringParam(ctx, "description") ?? existing.description),
      };

      await ctx.storage.collection("tag_options").put(updated.id, updated);
      return updated;
    },
  },
  deleteTagOption: {
    title: "Delete planner ticket tag option",
    target: "project",
    async run(ctx: CommandRunContext) {
      const optionId = stringParam(ctx, "option_id") ?? stringParam(ctx, "optionId") ?? stringParam(ctx, "id");
      if (!optionId) throw new Error("Tag option id is required.");

      const existing = (await readPlannerTagOptions(ctx)).find((option) => option.id === optionId);
      if (!existing) throw new Error(`Tag option not found: ${optionId}`);

      await ctx.storage.collection("tag_options").delete(optionId);
      return { optionId, deleted: true };
    },
  },
} satisfies Record<string, CommandDefinition>;
