import { describe, expect, test } from "bun:test";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { groupResourceEditorViews } from "./extension-resource-editor-grouping";

type ExtensionPanelRecord = DashboardExtensionMetadata["panels"][number];

const panel = (overrides: Partial<ExtensionPanelRecord> & { id: string }): ExtensionPanelRecord =>
  ({
    extensionId: "ext",
    title: overrides.id,
    region: "main",
    closable: false,
    webview: { id: overrides.id, entry: "entry", capabilities: [] },
    ...overrides,
  }) as ExtensionPanelRecord;

describe("groupResourceEditorViews", () => {
  test("pairs the main editor with companion side-panels for the same resource kind", () => {
    const properties = panel({
      id: "properties",
      resourceKind: "ticket",
      region: "secondary",
    });
    const editor = panel({ id: "editor", resourceKind: "ticket" });
    const modal = panel({ id: "modal", resourceKind: "ticket", region: "overlay" });

    const groups = groupResourceEditorViews([properties, editor, modal]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("ticket");
    // The editor (target main) is primary even though it is listed after the panel.
    expect(groups[0]?.primary.id).toBe("editor");
    expect(groups[0]?.companions.map((companion) => companion.id)).toEqual(["properties"]);
  });

  test("prefers an explicit main target over a no-target companion", () => {
    const files = panel({ id: "files", resourceKind: "ticket", region: "sidenav" });
    const editor = panel({ id: "editor", resourceKind: "ticket", region: "main" });

    const groups = groupResourceEditorViews([files, editor]);

    expect(groups[0]?.primary.id).toBe("editor");
    expect(groups[0]?.companions.map((companion) => companion.id)).toEqual(["files"]);
  });

  test("excludes modal and kind-less views, and keeps kinds independent", () => {
    const ticketEditor = panel({ id: "ticket-editor", resourceKind: "ticket" });
    const sessionEditor = panel({ id: "session-editor", resourceKind: "session" });
    const onlyModal = panel({ id: "create", resourceKind: "note", region: "overlay" });
    const kindless = panel({ id: "overview" });

    const groups = groupResourceEditorViews([ticketEditor, sessionEditor, onlyModal, kindless]);

    expect(groups.map((group) => group.kind).sort()).toEqual(["session", "ticket"]);
    expect(groups.every((group) => group.companions.length === 0)).toBe(true);
  });
});
