import type { CreateTagInput, CreateTagOptionInput, UpdateTagInput, UpdateTagOptionInput } from "../api/tags";
import type { Tag, TagOption } from "../resources";
import {
  executePlannerCommand,
  listPlannerCollection,
  toPlannerTagFromValue,
  toPlannerTagOptionFromValue,
  toPlannerTags,
} from "./planner";
import type { RequestFn } from "./request";

export type TagClient = {
  list(projectId: string): Promise<Tag[]>;
  create(projectId: string, input: CreateTagInput): Promise<Tag>;
  update(projectId: string, tagId: string, input: UpdateTagInput): Promise<Tag>;
  delete(projectId: string, tagId: string): Promise<void>;
  createOption(projectId: string, tagId: string, input: CreateTagOptionInput): Promise<TagOption>;
  updateOption(projectId: string, tagId: string, optionId: string, input: UpdateTagOptionInput): Promise<TagOption>;
  deleteOption(projectId: string, tagId: string, optionId: string): Promise<void>;
};

export const createTagClient = (request: RequestFn): TagClient => ({
  list: async (projectId) => {
    const [tags, options] = await Promise.all([
      listPlannerCollection(request, projectId, "tags"),
      listPlannerCollection(request, projectId, "tag_options"),
    ]);
    return toPlannerTags(projectId, tags, options);
  },
  create: async (projectId, input) =>
    toPlannerTagFromValue(projectId, await executePlannerCommand(request, projectId, "createTag", input)),
  update: async (projectId, tagId, input) =>
    toPlannerTagFromValue(
      projectId,
      await executePlannerCommand(request, projectId, "updateTag", { tag_id: tagId, ...input }),
    ),
  delete: async (projectId, tagId) => {
    await executePlannerCommand(request, projectId, "deleteTag", { tag_id: tagId });
  },
  createOption: async (projectId, tagId, input) =>
    toPlannerTagOptionFromValue(
      await executePlannerCommand(request, projectId, "createTagOption", { tag_id: tagId, ...input }),
    ),
  updateOption: async (projectId, tagId, optionId, input) =>
    toPlannerTagOptionFromValue(
      await executePlannerCommand(request, projectId, "updateTagOption", {
        tag_id: tagId,
        option_id: optionId,
        ...input,
      }),
    ),
  deleteOption: async (projectId, tagId, optionId) => {
    await executePlannerCommand(request, projectId, "deleteTagOption", { tag_id: tagId, option_id: optionId });
  },
});
