import { describe, expect, test } from "bun:test";
import {
  buildTagDraftPayload,
  createTagSettingsDraft,
  hasTagDraftChanges,
  saveTagDraft,
  saveTagDraftWithRecovery,
  type TagSettingsCommandId,
  type TagSettingsDraft,
  type TagSettingsTag,
  tagOptionsToEditorValues,
  tagSettingsDraftsVersion,
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
  name: tag.name,
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
      name: latestTag.name,
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
    expect(tagSettingsDraftVersion(latestTag)).toBe(
      `tag-1:${latestTag.name}:multi_select:option-1:Dashboard:blue:sparkles:0`,
    );
  });

  test("distinguishes tag collections when values contain version separators", () => {
    const separateTags: TagSettingsTag[] = [
      { ...tag, id: "first", options: [] },
      { ...tag, id: "second", type: "multi_select", options: [] },
    ];
    const joinedTag: TagSettingsTag[] = [
      { ...tag, id: "first:single_select|second", type: "multi_select", options: [] },
    ];

    expect(tagSettingsDraftsVersion(separateTags)).not.toBe(tagSettingsDraftsVersion(joinedTag));
  });

  test("detects type changes without mutating the saved tag", () => {
    const draft = { ...unchangedDraft(), type: "multi_select" as const };

    expect(hasTagDraftChanges(tag, draft)).toBe(true);
    expect(tag.type).toBe("single_select");
  });

  test("builds an atomic payload with type, creates, updates, and deletes", () => {
    const draft: TagSettingsDraft = {
      name: tag.name,
      type: "multi_select",
      options: [
        { id: "option-1", name: "API v2", color: "blue", sortOrder: 0, icon: null },
        { id: "new-option", name: "Dashboard", color: "green", sortOrder: 1, icon: null, isNew: true },
      ],
      deletedIds: new Set(["legacy-option"]),
    };

    expect(buildTagDraftPayload(tag, draft)).toEqual({
      tagId: "tag-1",
      name: undefined,
      type: "multi_select",
      optionsToCreate: [{ name: "Dashboard", color: "green", icon: "circle" }],
      optionsToUpdate: [{ id: "option-1", name: "API v2", color: "blue", icon: "circle" }],
      optionIdsToDelete: ["legacy-option"],
    });
  });

  test("carries a renamed tag definition into the payload", () => {
    const draft = { ...unchangedDraft(), name: "Surfaces" };

    expect(hasTagDraftChanges(tag, draft)).toBe(true);
    expect(buildTagDraftPayload(tag, draft).name).toBe("Surfaces");
    expect(tag.name).toBe("Surface");
  });

  test("omits an unchanged name and type and skips untouched options in the payload", () => {
    expect(buildTagDraftPayload(tag, unchangedDraft())).toEqual({
      tagId: "tag-1",
      name: undefined,
      type: undefined,
      optionsToCreate: [],
      optionsToUpdate: [],
      optionIdsToDelete: [],
    });
  });

  test("saves the whole draft in a single applyDraft command", async () => {
    const calls: Array<{ commandId: TagSettingsCommandId; params: Record<string, unknown> }> = [];
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
        commandId: "pstdio.pstdio-planner.command.ticketTag.applyDraft",
        params: {
          tagId: "tag-1",
          type: "multi_select",
          optionsToCreate: [{ name: "Dashboard", color: "green", icon: "circle" }],
          optionsToUpdate: [],
          optionIdsToDelete: [],
        },
      },
    ]);
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
