import { describe, expect, test } from "bun:test";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import { createWorkbenchCore } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { createDashboardKanbanAdapter } from "./extension-kanban-adapter";
import { metadata, response } from "./module-test-fixtures";

describe("dashboard Kanban adapter", () => {
  test("keeps non-workspace badge lists on the generic renderer", () => {
    const genericRender = () => "generic badge";
    const { adapter, disposable } = createDashboardKanbanAdapter({
      ctx: createWorkbenchCore(),
      executeCommand: async () => response,
      metadata: metadata as ResolvedWorkbenchExtensionMetadata,
      projectId: "project-1",
    });
    const attribute = {
      id: "contributors",
      label: "Contributors",
      type: { kind: "string" },
      display: { kind: "badge-list", itemsAttributeId: "contributorItems" },
      render: genericRender,
    } satisfies AttributeDescriptor;

    const decorated = adapter.decorateAttribute?.({} as never, attribute);
    const rendered = decorated?.render?.("ada", {
      id: "recipe-1",
      title: "Soup",
      attributes: {
        contributorItems: [{ id: "ada", label: "Ada", resource: { type: "person", id: "ada" } }],
      },
    });

    expect(rendered).toBe("generic badge");
    disposable.dispose();
  });

  test("keeps mixed resource badge lists on the generic renderer", () => {
    const genericRender = () => "mixed badges";
    const { adapter, disposable } = createDashboardKanbanAdapter({
      ctx: createWorkbenchCore(),
      executeCommand: async () => response,
      metadata: metadata as ResolvedWorkbenchExtensionMetadata,
      projectId: "project-1",
    });
    const attribute = {
      id: "participants",
      label: "Participants",
      type: { kind: "string" },
      display: { kind: "badge-list", itemsAttributeId: "participantItems" },
      render: genericRender,
    } satisfies AttributeDescriptor;

    const decorated = adapter.decorateAttribute?.({} as never, attribute);
    const rendered = decorated?.render?.("ada", {
      id: "recipe-1",
      title: "Soup",
      attributes: {
        participantItems: [
          { id: "ada", label: "Ada", resource: { type: "person", id: "ada" } },
          { id: "workspace-1", label: "Workspace", resource: { type: "workspace", id: "workspace-1" } },
        ],
      },
    });

    expect(rendered).toBe("mixed badges");
    disposable.dispose();
  });
});
