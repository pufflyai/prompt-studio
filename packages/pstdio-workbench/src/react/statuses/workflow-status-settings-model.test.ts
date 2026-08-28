import { describe, expect, test } from "bun:test";
import type { WorkflowStatus } from "../../core";
import { statusNeedsUpdate, toStatusEditorValue, toWorkflowStatus } from "./workflow-status-settings-model";

describe("workflow status settings model", () => {
  test("shows, saves, and restores provider-declared status actions", () => {
    const status = {
      id: "done",
      label: "Done",
      color: "green",
      sortOrder: 100,
      actions: ["archive_all"],
    } as WorkflowStatus;

    const editorValue = toStatusEditorValue(status);
    expect(editorValue.actions).toEqual(["archive_all"]);

    const draft = { ...editorValue, actions: [] };
    expect(statusNeedsUpdate(status, draft)).toBe(true);
    expect(toWorkflowStatus(draft).actions).toEqual([]);
  });
});
