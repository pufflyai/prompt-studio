import { Box } from "@chakra-ui/react";
import { contributionRefId, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTreeOwner, TreeContext, WorkbenchModuleContext, WorkbenchPageContribution } from "../../core";
import { WorkbenchResourceActivity } from "../../react/resource-activity/resource-activity";
import type { InternalRegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

export const resourceNavigationMenuId = (pageId: string) => `${pageId}:resources`;
export const resourceActivityMenuId = (viewId: string) => `${viewId}:activity`;

const registerResources = (
  workbench: WorkbenchModuleContext,
  page: WorkbenchPageContribution,
  ownerViewId: string,
  projectId: string,
) => {
  const owner: NavigationTreeOwner = { kind: "page", id: page.id, extensionId: page.ref.extensionId ?? "pstdio" };
  if (!workbench.navigationTrees.resolveOwner("page", page.id)) return [];
  const id = resourceNavigationMenuId(page.id);
  const context = (ctx: TreeContext) => ({
    projectId,
    resource: ctx.resource,
    signal: ctx.signal,
    onProgress: ctx.onProgress,
  });
  return [
    workbench.views.registerView({
      id,
      title: "Resources",
      icon: "Files",
      body: {
        kind: "tree",
        queryScope: { projectId, extensionId: page.ref.extensionId ?? "pstdio" },
        getReadKey: (ctx) => workbench.navigationTrees.getReadKey(owner, { projectId, resource: ctx.resource }),
        subscribe: (_ctx, invalidate) => {
          const subscription = workbench.navigationTrees.onDidChange(invalidate);
          return () => subscription.dispose();
        },
        getStructure: (ctx) =>
          workbench.navigationTrees.getStructure(owner, "content", { projectId, resource: ctx.resource }),
        defaultExpandedSectionIds: workbench.navigationTrees.getDefaultExpandedSectionIds(owner),
        defaultExpandedNodeIds: workbench.navigationTrees.getDefaultExpandedNodeIds(owner),
        getHeader: (ctx) => workbench.navigationTrees.getSections(owner, "header", context(ctx)),
        getBody: (ctx) => workbench.navigationTrees.getSections(owner, "content", context(ctx)),
        getFooter: (ctx) => workbench.navigationTrees.getSections(owner, "footer", context(ctx)),
        getChildren: (node, ctx) => workbench.navigationTrees.getChildren(node, context(ctx)),
        moveNode: (source, target, ctx) =>
          workbench.navigationTrees.moveNode(source, target, { ...context(ctx), position: ctx.position }),
      },
    }),
    workbench.viewMenus.registerViewMenu({
      id,
      ownerViewId,
      viewId: id,
      side: "right",
      priority: 100,
      purpose: "resources",
      config: { pageId: page.id },
    }),
  ];
};

/** Project chrome stays routed; these companions project only their live page owner's data. */
export const registerResourcePageMenus = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
  const { workbench, projectId } = input;
  const disposables = [];
  const activityOwners = new Set<string>();
  for (const page of input.metadata.pages) {
    if (!page.resource || page.main.kind !== "view") continue;
    const ownerViewId = workbench.views.getView(contributionRefId(page.main.view))?.id;
    if (!ownerViewId) continue;
    disposables.push(...registerResources(workbench, page, ownerViewId, projectId));
    const hasActivity = page.resource.kinds.some(
      (ref) => workbench.resources.getKind(ref.id, ref.extensionId ?? page.ref.extensionId)?.activity,
    );
    if (!hasActivity || activityOwners.has(ownerViewId)) continue;
    activityOwners.add(ownerViewId);
    const id = resourceActivityMenuId(ownerViewId);
    disposables.push(
      workbench.views.registerView({
        id,
        title: "Activity",
        icon: "TextPen",
        body: {
          kind: "react",
          render: ({ workbench, instance, visible }) => {
            const resource = instance.resource;
            const binding = resource && workbench.resources.getKind(resource.type, resource.extensionId)?.activity;
            return resource && binding ? (
              <Box h="full" overflow="auto">
                <WorkbenchResourceActivity
                  key={resourceKey(resource)}
                  workbench={workbench}
                  binding={binding}
                  resource={resource}
                  ownerInstanceId={instance.menuOwnerWidgetId}
                  visible={visible !== false}
                  menu
                />
              </Box>
            ) : null;
          },
        },
      }),
    );
    disposables.push(
      workbench.viewMenus.registerViewMenu({
        id,
        ownerViewId,
        viewId: id,
        side: "right",
        priority: 0,
        purpose: "activity",
      }),
    );
  }
  return disposables;
};
