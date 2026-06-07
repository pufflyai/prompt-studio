import { describe, expect, test } from "bun:test";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { groupResourceEditorViews } from "./extension-resource-editor-grouping";

type ExtensionViewRecord = DashboardExtensionMetadata["views"][number];

const view = (overrides: Partial<ExtensionViewRecord> & { id: string }): ExtensionViewRecord =>
  ({
    extensionId: "ext",
    slotId: "workbench.main",
    title: overrides.id,
    webview: { id: overrides.id, entry: "entry", capabilities: [] },
    ...overrides,
  }) as ExtensionViewRecord;

describe("groupResourceEditorViews", () => {
  test("pairs the main editor with companion side-panels for the same resource kind", () => {
    const properties = view({ id: "properties", resourceKind: "ticket", target: "workbench.main.right" });
    const editor = view({ id: "editor", resourceKind: "ticket" });
    const modal = view({ id: "modal", resourceKind: "ticket", surface: "modal" });

    const groups = groupResourceEditorViews([properties, editor, modal]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("ticket");
    // The editor (target main) is primary even though it is listed after the panel.
    expect(groups[0]?.primary.id).toBe("editor");
    expect(groups[0]?.companions.map((companion) => companion.id)).toEqual(["properties"]);
  });

  test("excludes modal and kind-less views, and keeps kinds independent", () => {
    const ticketEditor = view({ id: "ticket-editor", resourceKind: "ticket" });
    const sessionEditor = view({ id: "session-editor", resourceKind: "session" });
    const onlyModal = view({ id: "create", resourceKind: "note", surface: "modal" });
    const kindless = view({ id: "overview" });

    const groups = groupResourceEditorViews([ticketEditor, sessionEditor, onlyModal, kindless]);

    expect(groups.map((group) => group.kind).sort()).toEqual(["session", "ticket"]);
    expect(groups.every((group) => group.companions.length === 0)).toBe(true);
  });
});
