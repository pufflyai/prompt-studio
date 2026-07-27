import { describe, expect, test } from "bun:test";
import type { ResourceContextAction } from "@pstdio/ui";
import { mergeKanbanViewRowActions } from "./kanban-view";

const action = (key: string, label: string, commandId?: string): ResourceContextAction => ({
  key,
  label,
  commandId,
  onClick: () => undefined,
});

describe("mergeKanbanViewRowActions", () => {
  test("keeps distinct actions that share a label", () => {
    const actions = mergeKanbanViewRowActions(
      [action("resource.archive", "Archive")],
      [action("contribution.archive", "Archive")],
    );

    expect(actions.map((item) => item.key)).toEqual(["resource.archive", "contribution.archive"]);
  });

  test("deduplicates the same action key", () => {
    const actions = mergeKanbanViewRowActions([action("archive", "Archive")], [action("archive", "Archive ticket")]);

    expect(actions.map((item) => item.key)).toEqual(["archive"]);
  });

  test("deduplicates the same command registered through resource and renderer actions", () => {
    const actions = mergeKanbanViewRowActions(
      [action("resource.create-workspace", "Create workspace", "pstdio-planner.create-workspace")],
      [action("create-workspace", "Create workspace", "pstdio-planner.create-workspace")],
    );

    expect(actions.map((item) => item.key)).toEqual(["resource.create-workspace"]);
  });
});
