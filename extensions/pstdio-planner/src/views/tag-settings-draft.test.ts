import { describe, expect, test } from "bun:test";
import {
  createTagSettingsDraft,
  hasTagDraftChanges,
  saveTagDraft,
  saveTagDraftWithRecovery,
  type TagSettingsCommandId,
  type TagSettingsCommandParams,
  type TagSettingsDraft,
  type TagSettingsTag,
  tagOptionsToEditorValues,
  tagSettingsDraftVersion,
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
  test("creates a fresh draft from the latest tag", () => {
    const latestTag: TagSettingsTag = {
      ...tag,
      type: "multi_select",
      options: [{ ...tag.options[0]!, name: "Dashboard", icon: "sparkles" }],
    };

    expect(createTagSettingsDraft(latestTag)).toEqual({
      type: "multi_select",
      options: [
        {
          id: "option-1",
          name: "Dashboard",
          color: "blue",
          icon: "sparkles",
          sortOrder: 0,
        },
      ],
      deletedIds: new Set(),
    });
    expect(tagSettingsDraftVersion(latestTag)).toBe("tag-1:multi_select:option-1:Dashboard:blue:sparkles:0");
  });

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
        commandId: "pstdio-planner.ticketTag.createOption",
        params: { tagId: "tag-1", name: "Dashboard", color: "green", icon: "circle" },
      },
      {
        commandId: "pstdio-planner.ticketTag.update",
        params: { tagId: "tag-1", type: "multi_select" },
      },
    ]);
  });

  test("does not save a type change after an option command fails", async () => {
    const calls: TagSettingsCommandId[] = [];
    const draft: TagSettingsDraft = {
      ...unchangedDraft(),
      type: "multi_select",
      options: [
        ...tagOptionsToEditorValues(tag.options),
        { id: "new-option", name: "Dashboard", color: "green", sortOrder: 1, icon: null, isNew: true },
      ],
    };

    await expect(
      saveTagDraft(
        (commandId) => {
          calls.push(commandId);
          throw new Error("create failed");
        },
        tag,
        draft,
      ),
    ).rejects.toThrow("create failed");

    expect(calls).toEqual(["pstdio-planner.ticketTag.createOption"]);
  });

  test("runs recovery before rethrowing a failed save", async () => {
    const calls: string[] = [];

    await expect(
      saveTagDraftWithRecovery(
        () => {
          calls.push("save");
          throw new Error("update failed");
        },
        () => {
          calls.push("recover");
        },
      ),
    ).rejects.toThrow("update failed");

    expect(calls).toEqual(["save", "recover"]);
  });
});
