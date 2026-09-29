import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench, type ResourceRef } from "../../core";
import { registerWorkbenchExtensionNavigationItems } from "./navigation-item-contributions";

describe("extension navigation items", () => {
  test("expands named groups by default", () => {
    const workbench = createWorkbench();
    const metadata = {
      navigationItems: [
        {
          id: "pstdio.lab.navigation-item.lab",
          extensionId: "pstdio.lab",
          owner: { extensionId: "pstdio", kind: "mode" as const, id: "project" },
          slot: "content" as const,
          group: "Lab",
          label: "Lab",
          action: {
            kind: "page" as const,
            page: { extensionId: "pstdio.lab", kind: "page" as const, id: "lab" },
          },
        },
      ],
      navigationTrees: [],
    } satisfies Pick<WorkbenchExtensionMetadata, "navigationItems" | "navigationTrees">;

    registerWorkbenchExtensionNavigationItems({ metadata, workbench });

    expect(
      workbench.navigationTrees.getDefaultExpandedSectionIds({
        kind: "mode",
        id: "project",
        extensionId: "pstdio",
      }),
    ).toEqual(["pstdio.lab:Lab"]);
  });
});

const projectOwner = { extensionId: "pstdio", kind: "mode", id: "project" } as const;
const animation = { type: "animation", id: "chat-turn" };

const visibilityConditions: Array<WorkbenchExtensionMetadata["navigationItems"][number]["when"]> = [
  undefined,
  { resourceType: [{ kind: "resource-kind", extensionId: "pstdio.lab", id: "animation" }] },
  { metadata: { editable: true } },
];
test.each(
  visibilityConditions,
)("navigation items only depend on the selected resource when their visibility does", (when) => {
  const workbench = createWorkbench();
  registerWorkbenchExtensionNavigationItems({
    workbench,
    metadata: {
      navigationTrees: [],
      navigationItems: [
        {
          id: "pstdio.lab.navigation-item.lab",
          extensionId: "pstdio.lab",
          owner: projectOwner,
          slot: "content",
          label: "Lab",
          when,
          action: { kind: "page", page: { extensionId: "pstdio.lab", kind: "page", id: "lab" } },
        },
      ],
    },
  });
  const initial = workbench.navigationTrees.getReadKey(projectOwner);
  const selected = workbench.navigationTrees.getReadKey(projectOwner, { resource: animation });
  expect(initial === selected).toBe(!when);
});

test.each([
  undefined,
  "selection",
  "project",
] as const)("navigation tree reads follow their declared resource scope (%s)", async (resourceScope) => {
  const workbench = createWorkbench();
  const resources: Array<ResourceRef | undefined> = [];
  workbench.views.registerView({
    id: "pstdio.lab.view.items",
    title: "Items",
    body: {
      kind: "tree",
      getBody: ({ resource }) => {
        resources.push(resource);
        return [{ id: "items", nodes: [{ id: "folder", label: "Items", collapsible: true }] }];
      },
      getChildren: (_node, { resource }) => {
        resources.push(resource);
        return [];
      },
    },
  });
  registerWorkbenchExtensionNavigationItems({
    workbench,
    metadata: {
      navigationItems: [],
      navigationTrees: [
        {
          id: "pstdio.lab.navigation-tree.items",
          extensionId: "pstdio.lab",
          owner: projectOwner,
          slot: "content",
          view: { extensionId: "pstdio.lab", kind: "view", id: "items" },
          resourceScope,
        },
      ],
    },
  });
  const initial = workbench.navigationTrees.getReadKey(projectOwner);
  const selected = workbench.navigationTrees.getReadKey(projectOwner, { resource: animation });
  expect(initial === selected).toBe(resourceScope === "project");
  const sections = await workbench.navigationTrees.getSections(projectOwner, "content", { resource: animation });
  await workbench.navigationTrees.getChildren(sections[0].nodes[0], { resource: animation });
  const expectedResource = resourceScope === "project" ? undefined : animation;
  expect(resources).toEqual([expectedResource, expectedResource]);
});
