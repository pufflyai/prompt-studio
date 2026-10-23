import { Spinner } from "@chakra-ui/react";
import { type PlacementIdentity, workbenchPages } from "@pstdio/sdk/extensions";
import type {
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchModuleContribution,
  WorkbenchPanelRegion,
  WorkbenchTabRetention,
} from "@pstdio/workbench";
import { lazy, Suspense } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
} from "@/shared/workspaces/workspace-options";
import { openDashboardSessionPanel, openSessionBubbleWidgets } from "./session-bubble";
import { registerSessionKeyboard } from "./session-keyboard";
import { registerSessionPanelPlacements } from "./session-panel-placements";
import { registerSessionPicker } from "./session-picker";

const SessionWidget = lazy(() =>
  import("@/modules/sessions/components/session-widget").then((module) => ({ default: module.SessionWidget })),
);

const metadataString = (resource: ResourceRef | undefined, key: string) => {
  const value = resource?.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};
const createDefaultWorkspaceResource = (ctx: WorkbenchModuleContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) return undefined;
  const workspace = createDashboardWorkspaceOptions(projectId)[0];
  if (!workspace) return undefined;
  return createDashboardWorkspaceOptionResource(workspace, projectId);
};
const getPrimaryWorkspaceResource = (ctx: WorkbenchModuleContext) => {
  const resource = ctx.getPrimaryResource();
  return resource?.type === "workspace" ? resource : undefined;
};
const createNewSessionDraftResource = (
  workspace: ResourceRef | undefined,
  projectId: string | undefined,
): ResourceRef => {
  const workspaceId = workspace?.id ?? metadataString(workspace, "workspaceId");
  const workspaceShorthand = metadataString(workspace, "workspaceShorthand");
  const workspaceBranch = metadataString(workspace, "workspaceBranch");
  const workspacePath = metadataString(workspace, "workspacePath");
  const workspaceTitle = workspace?.label ?? workspaceShorthand;
  const id = `${workspaceId ? `new-${workspaceId}` : "new"}-${globalThis.crypto.randomUUID()}`;
  return {
    type: "session-draft",
    extensionId: "pstdio",
    projectId,
    id,
    label: "New session",
    icon: "message-circle",
    metadata: {
      ...(workspaceId ? { workspaceId } : {}),
      ...(workspaceTitle ? { workspaceTitle } : {}),
      ...(workspaceShorthand ? { workspaceShorthand } : {}),
      ...(workspaceBranch ? { workspaceBranch } : {}),
      ...(workspacePath ? { workspacePath } : {}),
    },
  };
};
const registerSessionBubbleWidgets = (ctx: WorkbenchModuleContext, drafts?: DashboardSessionDraftPersistence) => {
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.sessionBubble,
      title: "New session",
      icon: "MessageCircle",
      body: {
        kind: "react",
        render: (input) => (
          <Suspense fallback={<Spinner />}>
            <SessionWidget input={input} drafts={drafts} />
          </Suspense>
        ),
      },
    },
    { priority: 30 },
  );
};
const openNewSessionDraft = (
  ctx: WorkbenchModuleContext,
  input: {
    workspace?: ResourceRef;
    sidePanel?: boolean;
    tabRetention?: WorkbenchTabRetention;
    replacePanel?: PlacementIdentity;
    from?: ResourceRef;
    region?: WorkbenchPanelRegion;
  } = {},
) => {
  const workspace = input.workspace ?? getPrimaryWorkspaceResource(ctx) ?? createDefaultWorkspaceResource(ctx);
  const draftResource = createNewSessionDraftResource(workspace, getDashboardSelectedProjectId(ctx));
  const identity = input.replacePanel;
  if (identity) {
    return ctx.navigation.openTarget(
      {
        kind: "viewer",
        operation: "switch",
        from: input.from,
        resource: draftResource,
        ...(identity.kind === "page" ? { page: workbenchPages.newSession } : {}),
      },
      { viewer: identity, projectId: getDashboardSelectedProjectId(ctx) },
    );
  }
  if (!input.sidePanel && input.region === undefined) {
    return openSessionsPage(ctx, draftResource);
  }
  return openSessionBubbleWidgets(ctx, {
    resource: draftResource,
    tabRetention: input.tabRetention,
    region: input.region,
  });
};
const registerSessionBubbleCommands = (ctx: WorkbenchModuleContext) => {
  ctx.commands.registerCommand(
    {
      id: dashboardCommandIds.openSessionPanel,
      label: "Open session panel",
      category: "Dashboard",
      icon: "MessageCircle",
    },
    {
      execute: async (args, context) => {
        const {
          resource = context?.resource,
          selectWorkspaceSidenav = true,
          tabRetention,
          replacePanel,
          from = context?.resource,
        } = (args ?? {}) as {
          resource?: ResourceRef;
          selectWorkspaceSidenav?: boolean;
          tabRetention?: WorkbenchTabRetention;
          replacePanel?: PlacementIdentity;
          from?: ResourceRef;
        };
        if (resource?.type !== "session" || !resource.id) return undefined;
        const bubble = openDashboardSessionPanel(ctx, {
          resource,
          tabRetention,
          replacePanel,
          from,
        });
        if (
          selectWorkspaceSidenav &&
          getPrimaryWorkspaceResource(ctx) &&
          ctx.commands.getCommand(dashboardCommandIds.selectWorkspaceSidenavSession)
        ) {
          await ctx.commands.executeCommand(dashboardCommandIds.selectWorkspaceSidenavSession, {
            resource,
          });
        }
        return bubble;
      },
    },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.createSession, label: "New session", category: "Dashboard", icon: "MessageSquarePlus" },
    {
      execute: async (args, context) => {
        const {
          workspace,
          replacePanel,
          sidePanel = false,
          from = context?.resource,
        } = (args ?? {}) as {
          workspace?: ResourceRef;
          replacePanel?: PlacementIdentity;
          sidePanel?: boolean;
          from?: ResourceRef;
        };
        // The tab tray's + asks for a new tab; a tab menu replaces its own placement.
        const isNewTab = context?.source === "panel-add";
        await openNewSessionDraft(ctx, {
          workspace,
          replacePanel: isNewTab ? undefined : replacePanel,
          from,
          sidePanel: sidePanel || (isNewTab && context?.region !== "main"),
          tabRetention: isNewTab ? "persistent" : undefined,
          region: context?.region,
        });
        return undefined;
      },
    },
  );
};
interface CreateSessionBubbleModuleInput {
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
}
export const createSessionBubbleModule = (input: CreateSessionBubbleModuleInput = {}) =>
  ({
    id: "dashboard.session-bubble",
    activate(ctx) {
      registerSessionBubbleWidgets(ctx, input.sessionDraftPersistence);
      registerSessionBubbleCommands(ctx);
      registerSessionKeyboard(ctx);
      registerSessionPicker(ctx);
      return registerSessionPanelPlacements(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
