import { buildSessionOverflowActions } from "@/features/sessions/session-actions";
import { buildWorkspaceDeleteOverflowAction } from "@/features/workspaces/pages/workspace-page-actions";
import type { HeaderActionItem } from "@/shared/extensions/components/header-actions";
import {
  headerActionsToResourceContextActions,
  toSidebarContextMenuItems,
} from "@/shared/extensions/context-menu-actions";
import type { useExtensionResourceContextMenuActions } from "@/shared/extensions/hooks/use-extension-resource-context-menu-actions";
import { buildTicketExtensionResource, buildWorkspaceExtensionResource } from "@/shared/extensions/resource-context";

type ExtensionContextMenuActions = ReturnType<typeof useExtensionResourceContextMenuActions>;
type TicketResource = Parameters<typeof buildTicketExtensionResource>[0]["ticket"];
type WorkspaceResource = Parameters<typeof buildWorkspaceExtensionResource>[0]["workspace"];

export const buildTicketDetailsTicketContextMenuItems = (input: {
  ticketContextMenuActions: ExtensionContextMenuActions;
  projectId: string | undefined;
  ticket: TicketResource;
  defaultOverflowActions: HeaderActionItem[];
}) => {
  const { ticketContextMenuActions, projectId, ticket, defaultOverflowActions } = input;

  return toSidebarContextMenuItems([
    ...ticketContextMenuActions.resolveActions(buildTicketExtensionResource({ projectId, ticket })),
    ...headerActionsToResourceContextActions({ actions: defaultOverflowActions }),
  ]);
};

export const buildTicketDetailsWorkspaceContextMenuItems = (input: {
  workspaceContextMenuActions: ExtensionContextMenuActions;
  projectId: string | undefined;
  ticket: TicketResource;
  workspace: WorkspaceResource;
  isDeletePending: boolean;
  onDeleteWorkspace: () => void;
  t: (key: string) => string;
}) => {
  const { workspaceContextMenuActions, projectId, ticket, workspace, isDeletePending, onDeleteWorkspace, t } = input;

  return toSidebarContextMenuItems([
    ...workspaceContextMenuActions.resolveActions(buildWorkspaceExtensionResource({ projectId, ticket, workspace })),
    ...headerActionsToResourceContextActions({
      actions: buildWorkspaceDeleteOverflowAction({
        t,
        hasSelectedWorkspace: true,
        isMutationPending: isDeletePending,
        onDeleteWorkspace,
      }),
    }),
  ]);
};

export const buildTicketDetailsSessionContextMenuItems = (input: {
  session: { id: string; agentSessionId?: string | null };
  onArchiveSession: () => void;
  t: (key: string) => string;
}) => {
  const { session, onArchiveSession, t } = input;

  return toSidebarContextMenuItems(
    headerActionsToResourceContextActions({
      actions: buildSessionOverflowActions({
        sessionId: session.id,
        agentSessionId: session.agentSessionId,
        onArchive: onArchiveSession,
        t,
      }),
    }),
  );
};
