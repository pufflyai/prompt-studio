import type {
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchModuleContribution,
  WorkbenchTabPosition,
  WorkbenchTabRetention,
} from "@pstdio/workbench";
import { SessionWidget } from "@/modules/sessions/components/session-widget";
import { forgetDashboardSession } from "@/modules/sessions/state/session-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
} from "@/shared/workspaces/workspace-options";
import { openDashboardSessionPanel, openSessionBubbleWidgets, selectSidenavSessionNode } from "./session-bubble";
import { SessionTabContent, SessionTabMenu } from "./session-tab";

const sessionTabRendererId = "dashboard-workbench.session-tab";
const sessionTabMenuRendererId = "dashboard-workbench.session-tab-menu";

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

const getWorkspaceModeResource = (ctx: WorkbenchModuleContext) => {
  if (ctx.modes.getActiveModeId() !== "workspace") return undefined;

  const resource = ctx.getPrimaryResource();
  return resource?.kind === "workspace" ? resource : undefined;
};

const createNewSessionDraftResource = (workspace: ResourceRef | undefined): ResourceRef => {
  const workspaceId = workspace?.id ?? metadataString(workspace, "workspaceId");
  const workspaceShorthand = metadataString(workspace, "workspaceShorthand");
  const workspaceBranch = metadataString(workspace, "workspaceBranch");
  const workspacePath = metadataString(workspace, "workspacePath");
  const workspaceTitle = workspace?.label ?? workspaceShorthand;
  const id = `${workspaceId ? `new-${workspaceId}` : "new"}-${globalThis.crypto.randomUUID()}`;

  return {
    kind: "session-draft",
    uri: `dashboard-workbench://session-draft/${id}`,
    id,
    label: "New session",
    icon: "PenBox",
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
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.sessionBubble,
      title: "New session",
      region: "side",
      singleton: false,
      closable: true,
      rendererId: dashboardWidgetIds.sessionBubble,
      openCommandId: dashboardCommandIds.createSession,
      eligibleLocations: {
        resourceKinds: ["dashboard-view", "ticket", "workspace"],
        canOpen: (resource) => resource.kind !== "dashboard-view" || resource.id !== dashboardResources.sessions.id,
      },
      icon: "MessageCircle",
      tab: {
        contentRendererId: sessionTabRendererId,
        customMenuRendererId: sessionTabMenuRendererId,
      },
      priority: 30,
    },
    { priority: 30 },
  );

  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessionBubble,
    render: (input) => <SessionWidget input={input} drafts={drafts} />,
  });
  ctx.renderers.registerRenderer({
    id: sessionTabRendererId,
    render: (input) => <SessionTabContent input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: sessionTabMenuRendererId,
    render: (input) => <SessionTabMenu input={input} />,
  });
};

const openNewSessionDraft = (
  ctx: WorkbenchModuleContext,
  input: { workspace?: ResourceRef; replaceWidgetId?: string; tabRetention?: WorkbenchTabRetention } = {},
) => {
  const workspace = input.workspace ?? getWorkspaceModeResource(ctx) ?? createDefaultWorkspaceResource(ctx);
  const draftResource = createNewSessionDraftResource(workspace);
  forgetDashboardSession(ctx);
  selectSidenavSessionNode(ctx, undefined);

  if (ctx.modes.getActiveModeId() === "sessions" && ctx.layout.getPanel(dashboardWidgetIds.session)) {
    return ctx.resources.openResource(draftResource, { replaceActive: true });
  }

  if (ctx.sidePanel.getMode() === "closed") ctx.sidePanel.setMode("floating");
  const placement = openSessionBubbleWidgets(ctx, {
    resource: draftResource,
    title: draftResource.label,
    replaceWidgetId: input.replaceWidgetId,
    tabRetention: input.tabRetention,
  });
  return placement.bubble;
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
      execute: async (args) => {
        const {
          resource,
          preservePanelMode = false,
          replaceWidgetId,
          selectWorkspaceSidenav = true,
          tabPosition,
          tabRetention,
        } = (args ?? {}) as {
          resource?: ResourceRef;
          preservePanelMode?: boolean;
          replaceWidgetId?: string;
          selectWorkspaceSidenav?: boolean;
          tabPosition?: WorkbenchTabPosition;
          tabRetention?: WorkbenchTabRetention;
        };
        if (resource?.kind !== "session" || !resource.id) return undefined;

        const bubble = openDashboardSessionPanel(ctx, {
          resource,
          replaceWidgetId,
          tabPosition,
          tabRetention,
          preservePanelMode,
        });
        if (
          selectWorkspaceSidenav &&
          ctx.modes.getActiveModeId() === "workspace" &&
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
    { id: dashboardCommandIds.createSession, label: "New session", category: "Dashboard", icon: "PenBox" },
    {
      execute: (args, context) => {
        const { replaceWidgetId, workspace } = (args ?? {}) as { replaceWidgetId?: string; workspace?: ResourceRef };
        // The tab tray's + asks for a new tab; everywhere else reuses the peek slot.
        const isNewTab = context?.source === "panel-add";
        return openNewSessionDraft(ctx, {
          workspace,
          replaceWidgetId: isNewTab ? undefined : replaceWidgetId,
          tabRetention: isNewTab ? "persistent" : undefined,
        });
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
    },
  }) satisfies WorkbenchModuleContribution;
