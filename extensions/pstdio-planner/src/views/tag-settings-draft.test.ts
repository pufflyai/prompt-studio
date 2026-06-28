import { describe, expect, test } from "bun:test";
import {
  hasTagDraftChanges,
  saveTagDraft,
  type TagSettingsCommandId,
  type TagSettingsCommandParams,
  type TagSettingsDraft,
  type TagSettingsTag,
  tagOptionsToEditorValues,
} from "./tag-settings-draft";

const tag = {
  id: "tag-1",
  name: "Surface",
  type: "single_select",
  options: [
    {
      id: "option-1",
      name: "API",
      color: "blue",
      sortOrder: 0,
      icon: null,
    },
  ],
} satisfies TagSettingsTag;

const unchangedDraft = (): TagSettingsDraft => ({
  type: tag.type,
  options: tagOptionsToEditorValues(tag.options),
  deletedIds: new Set(),
});

describe("tag settings draft", () => {
  test("detects type changes without mutating the saved tag", () => {
    const draft = { ...unchangedDraft(), type: "multi_select" as const };

    expect(hasTagDraftChanges(tag, draft)).toBe(true);
    expect(tag.type).toBe("single_select");
  });

  test("saves tag type and sends a string icon for new default-icon options", async () => {
    const calls: Array<{ commandId: TagSettingsCommandId; params: TagSettingsCommandParams }> = [];
    const draft: TagSettingsDraft = {
      ...unchangedDraft(),
      type: "multi_select",
      options: [
        ...tagOptionsToEditorValues(tag.options),
        {
          id: "new-option",
          name: "Dashboard",
          color: "green",
          sortOrder: 1,
          icon: null,
          isNew: true,
        },
      ],
    };

    await saveTagDraft(
      (commandId, params) => {
        calls.push({ commandId, params });
        return Promise.resolve(undefined);
      },
      tag,
      draft,
    );

    expect(calls).toEqual([
      {
        commandId: "pstdio-planner.ticketTag.update",
        params: { tagId: "tag-1", type: "multi_select" },
      },
      {
        commandId: "pstdio-planner.ticketTag.createOption",
        params: { tagId: "tag-1", name: "Dashboard", color: "green", icon: "circle" },
      },
    ]);
  });
});
