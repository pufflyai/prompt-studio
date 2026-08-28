import { Box, Icon, Menu } from "@chakra-ui/react";
import type { KanbanRendererResourceRef } from "@pstdio/sdk/extensions";
import {
  ListRow,
  type SessionCompletionStatus,
  sessionCompletionStatuses,
  WorkspaceBadge,
  type WorkspaceBadgeProps,
} from "@pstdio/ui";
import { DiffBubble } from "@pstdio/ui/diff";
import type { KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import type { ResourceRef } from "@pstdio/workbench";
import { GitBranch } from "lucide-react";
import { createElement, useEffect, useState } from "react";
import { createDashboardResource } from "@/shared/app/resources";
import {
  type ExtensionResourceReference,
  normalizeExtensionResourceReference,
} from "@/shared/workbench/resource-hierarchy";
import {
  getDashboardWorkspaceDiffSummary,
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";

export interface ExtensionWorkspaceBadgeSession {
  id: string;
  status: SessionCompletionStatus;
}

export interface ExtensionWorkspaceBadgeItem {
  id: string;
  label: string;
  icon?: string;
  resource?: KanbanRendererResourceRef;
  createdAt?: string;
  resourceParent?: ExtensionResourceReference;
  session?: ExtensionWorkspaceBadgeSession;
}

type ExtensionWorkspaceBadgeSessionItem = ExtensionWorkspaceBadgeItem & { session: ExtensionWorkspaceBadgeSession };

const supportedSessionStatuses = new Set<string>(sessionCompletionStatuses);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const isExtensionResource = (value: unknown): value is KanbanRendererResourceRef =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

const workspaceTypeFrom = (value: unknown): WorkspaceBadgeProps["workspaceType"] =>
  value === "current_branch" ? "current_branch" : "worktree";

// A status the shared session contract does not define must not reach the indicator, which
// would render it as its generic "unknown" state instead of admitting it has none.
const badgeSessionFrom = (value: unknown): ExtensionWorkspaceBadgeSession | undefined => {
  if (!isRecord(value)) return undefined;
  const id = textValue(value.id);
  const status = textValue(value.status);
  if (!id || !status || !supportedSessionStatuses.has(status)) return undefined;
  return { id, status: status as SessionCompletionStatus };
};

const hasBadgeSession = (item: ExtensionWorkspaceBadgeItem): item is ExtensionWorkspaceBadgeSessionItem =>
  Boolean(item.session);

export const normalizeWorkspaceBadgeItems = (value: unknown): ExtensionWorkspaceBadgeItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const resource = isExtensionResource(item.resource) ? item.resource : undefined;
    const label = textValue(item.label) ?? textValue(resource?.label) ?? id;
    const icon = textValue(item.icon);
    const createdAt = textValue(item.createdAt);
    const resourceParent = normalizeExtensionResourceReference(item.resourceParent);
    const session = badgeSessionFrom(item.session);
    return [
      {
        id,
        label,
        ...(icon ? { icon } : {}),
        ...(resource ? { resource } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(resourceParent ? { resourceParent } : {}),
        ...(session ? { session } : {}),
      },
    ];
  });
};

export const createWorkspaceBadgeResource = (item: ExtensionWorkspaceBadgeItem, projectId: string): ResourceRef =>
  createDashboardResource(
    item.resource?.type ?? "workspace",
    item.resource?.id ?? item.id,
    item.resource?.label ?? item.label,
    item.icon ?? "GitBranch",
    projectId,
    {
      ...item.resource?.metadata,
      workspaceId: item.resource?.id ?? item.id,
      ...(item.resourceParent ? { resourceParent: item.resourceParent } : {}),
    },
  );

// `sessionSurface: "side"` keeps the board in place and opens the session in the Side Panel.
// The label is only a fallback — the sessions module resolves the live title by session id.
export const createWorkspaceBadgeSessionResource = (
  item: ExtensionWorkspaceBadgeSessionItem,
  projectId: string,
): ResourceRef =>
  createDashboardResource("session", item.session.id, item.label, "MessageCircle", projectId, {
    sessionSurface: "side",
  });

const WorkspaceDiffTotals = (props: { workspaceId: string }) => {
  const { workspaceId } = props;
  const summary = getDashboardWorkspaceDiffSummary(workspaceId);

  if (!summary) return null;

  return <DiffBubble additions={summary.additions} deletions={summary.deletions} variant="ghost" size="small" />;
};

const stopWorkspaceBadgeRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

const workspaceIdFromBadgeItem = (item: ExtensionWorkspaceBadgeItem) => item.resource?.id ?? item.id;

export const createWorkspaceBadgeInteractionProps = (onActivate?: () => void) => ({
  onClick: (event: { stopPropagation: () => void }) => {
    stopWorkspaceBadgeRowActivation(event);
    onActivate?.();
  },
  onPointerDown: stopWorkspaceBadgeRowActivation,
  onKeyDown: stopWorkspaceBadgeRowActivation,
});

interface ExtensionWorkspaceBadgeDisplayProps {
  items: ExtensionWorkspaceBadgeItem[];
  projectId: string;
  value: unknown;
  openResource: (resource: ResourceRef) => void;
}

const ExtensionWorkspaceBadgeDisplay = (props: ExtensionWorkspaceBadgeDisplayProps) => {
  const { items, projectId, value, openResource } = props;
  const [, setDiffVersion] = useState(0);
  const selectedId = typeof value === "string" ? value : undefined;
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];
  const workspaceIdsKey = items.map(workspaceIdFromBadgeItem).join("\n");
  const selectedSummary = selectedItem
    ? getDashboardWorkspaceDiffSummary(workspaceIdFromBadgeItem(selectedItem))
    : undefined;
  const badgeLabel = selectedItem?.label;

  useEffect(() => {
    let cancelled = false;
    const workspaceIds = workspaceIdsKey ? workspaceIdsKey.split("\n") : [];
    const unsubscribe = subscribeDashboardWorkspaceDiffSummaries(() => setDiffVersion((version) => version + 1));
    void requestDashboardWorkspaceDiffSummaries(workspaceIds).then(() => {
      if (!cancelled) setDiffVersion((version) => version + 1);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [workspaceIdsKey]);

  if (!selectedItem) return null;

  const openItem = (item: ExtensionWorkspaceBadgeItem) => {
    openResource(createWorkspaceBadgeResource(item, projectId));
  };

  const badge = (
    <WorkspaceBadge
      workspaceType={workspaceTypeFrom(selectedItem.resource?.metadata?.workspaceType)}
      shorthand={badgeLabel}
      diffAdditions={selectedSummary?.additions}
      diffDeletions={selectedSummary?.deletions}
      hasMultipleWorkspaces={items.length > 1}
      sessionStatus={selectedItem.session?.status}
      showLeadingSessionIndicator={hasBadgeSession(selectedItem)}
      // Wired apart from the badge's own activation so the indicator opens the session
      // without also opening the workspace or the ticket card behind it.
      onSessionIndicatorClick={
        hasBadgeSession(selectedItem)
          ? () => openResource(createWorkspaceBadgeSessionResource(selectedItem, projectId))
          : undefined
      }
    />
  );

  if (items.length === 1) {
    return (
      <Box asChild display="inline-flex" minW="0" appearance="none" border="0" bg="transparent" p="0" cursor="pointer">
        <button
          type="button"
          data-testid="workspace-badge-trigger"
          {...createWorkspaceBadgeInteractionProps(() => openItem(selectedItem))}
        >
          {badge}
        </button>
      </Box>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box as="span" display="inline-flex" minW="0" {...createWorkspaceBadgeInteractionProps()}>
          {badge}
        </Box>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px" maxW="360px" bg="bg" zIndex="popover">
          {items.map((item) => (
            <Menu.Item key={item.id} value={item.id} asChild>
              <ListRow
                asChild
                variant="compact"
                label={item.label}
                icon={<Icon as={GitBranch} boxSize="16px" />}
                endContent={<WorkspaceDiffTotals workspaceId={workspaceIdFromBadgeItem(item)} />}
                onActivate={() => openItem(item)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

export const createBadgeListRenderer =
  (input: { itemsAttributeId: string; projectId: string; openResource: (resource: ResourceRef) => void }) =>
  (value: unknown, row: KanbanRendererRow) => {
    const items = normalizeWorkspaceBadgeItems(row.attributes[input.itemsAttributeId]);
    if (items.length === 0) return null;
    return createElement(ExtensionWorkspaceBadgeDisplay, {
      items,
      projectId: input.projectId,
      value,
      openResource: input.openResource,
    });
  };
