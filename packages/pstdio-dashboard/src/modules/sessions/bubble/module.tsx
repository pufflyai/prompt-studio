import { workbenchPanels } from "@pstdio/sdk/extensions";
import type {
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchModuleContribution,
  WorkbenchTabRetention,
} from "@pstdio/workbench";
import { SessionWidget } from "@/modules/sessions/components/session-widget";
import { forgetDashboardSession } from "@/modules/sessions/state/session-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
} from "@/shared/workspaces/workspace-options";
import { openDashboardSessionPanel, openSessionBubbleWidgets, selectSidenavSessionNode } from "./session-bubble";
import { createSessionTabPresentation } from "./session-tab-presentation";

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
const createNewSessionDraftResource = (workspace: ResourceRef | undefined): ResourceRef => {
  const workspaceId = workspace?.id ?? metadataString(workspace, "workspaceId");
  const workspaceShorthand = metadataString(workspace, "workspaceShorthand");
  const workspaceBranch = metadataString(workspace, "workspaceBranch");
  const workspacePath = metadataString(workspace, "workspacePath");
  const workspaceTitle = workspace?.label ?? workspaceShorthand;
  const id = `${workspaceId ? `new-${workspaceId}` : "new"}-${globalThis.crypto.randomUUID()}`;
  return {
    type: "session-draft",
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
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.sessionBubble,
      title: "Session",
      icon: "MessageCircle",
      body: { kind: "react", render: (input) => <SessionWidget input={input} drafts={drafts} /> },
    },
    { priority: 30 },
  );
  ctx.modePlacements.registerPlacement({
    id: "dashboard.session-bubble.project",
    ref: workbenchPanels.projectSession,
    modeId: "project",
    item: {
      kind: "binding",
      binding: {
        kinds: [
          {
            kind: "resource-kind",
            id: "session",
          },
          {
            kind: "resource-kind",
            id: "session-draft",
          },
        ],
        view: {
          kind: "view",
          id: dashboardWidgetIds.sessionBubble,
        },
        cardinality: "many",
        add: {
          kind: "command",
          target: { command: { kind: "command", extensionId: "pstdio", id: dashboardCommandIds.createSession } },
        },
      },
    },
    region: "side",
    tab: createSessionTabPresentation(ctx),
  });
};
const openNewSessionDraft = (
  ctx: WorkbenchModuleContext,
  input: {
    workspace?: ResourceRef;
    tabRetention?: WorkbenchTabRetention;
  } = {},
) => {
  const workspace = input.workspace ?? getPrimaryWorkspaceResource(ctx) ?? createDefaultWorkspaceResource(ctx);
  const draftResource = createNewSessionDraftResource(workspace);
  forgetDashboardSession(ctx);
  selectSidenavSessionNode(ctx, undefined);
  if (ctx.modes.getActiveModeId() === "sessions") {
    return openSessionsPage(ctx, draftResource);
  }
  return openSessionBubbleWidgets(ctx, {
    resource: draftResource,
    title: draftResource.label,
    tabRetention: input.tabRetention,
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
      execute: async (args) => {
        const {
          resource,
          preservePanelMode = false,
          selectWorkspaceSidenav = true,
          tabRetention,
          pinPreviewSessions = false,
        } = (args ?? {}) as {
          resource?: ResourceRef;
          preservePanelMode?: boolean;
          selectWorkspaceSidenav?: boolean;
          tabRetention?: WorkbenchTabRetention;
          pinPreviewSessions?: boolean;
        };
        if (resource?.type !== "session" || !resource.id) return undefined;
        if (pinPreviewSessions) {
          for (const placement of ctx.layout.getLayout().regions.side.widgets) {
            if (
              placement.viewId !== dashboardWidgetIds.sessionBubble ||
              placement.tabRetention !== "preview" ||
              !placement.resource
            ) {
              continue;
            }
            await openSessionBubbleWidgets(ctx, {
              resource: placement.resource,
              tabRetention: "persistent",
            });
          }
        }
        const bubble = openDashboardSessionPanel(ctx, {
          resource,
          tabRetention,
          preservePanelMode,
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
    { id: dashboardCommandIds.createSession, label: "New session", category: "Dashboard", icon: "PenBox" },
    {
      execute: async (args, context) => {
        const { workspace } = (args ?? {}) as {
          workspace?: ResourceRef;
        };
        // The tab tray's + asks for a new tab; everywhere else reuses the peek slot.
        const isNewTab = context?.source === "panel-add";
        await openNewSessionDraft(ctx, {
          workspace,
          tabRetention: isNewTab ? "persistent" : undefined,
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
    },
  }) satisfies WorkbenchModuleContribution;
