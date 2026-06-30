import { Box, Icon, Menu } from "@chakra-ui/react";
import { ListRow, WorkspaceBadge, type WorkspaceBadgeProps } from "@pstdio/ui";
import type { DataRendererRow } from "@pstdio/ui/data-renderer";
import { DiffBubble } from "@pstdio/ui/diff";
import { GitBranch } from "lucide-react";
import type { ResourceRef } from "pstdio-workbench/core";
import { createElement, useEffect, useState } from "react";
import { createDashboardResource } from "@/shared/app/resources";
import {
  getDashboardWorkspaceDiffSummary,
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";

export interface ExtensionWorkspaceBadgeItem {
  id: string;
  name: string;
  shorthand?: string;
  type: WorkspaceBadgeProps["workspaceType"];
  createdAt?: string;
  ticketId?: string;
  ticketLabel?: string;
  ticketShorthand?: string;
  ticketBreadcrumb?: ExtensionWorkspaceTicketBreadcrumbItem[];
}

interface ExtensionWorkspaceTicketBreadcrumbItem {
  id: string;
  label: string;
  shorthand?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const workspaceTypeFrom = (value: unknown): ExtensionWorkspaceBadgeItem["type"] =>
  value === "current_branch" ? "current_branch" : "worktree";

const normalizeTicketBreadcrumbItems = (value: unknown): ExtensionWorkspaceTicketBreadcrumbItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const shorthand = textValue(item.shorthand);
    const label = textValue(item.label) ?? shorthand ?? id;
    return [{ id, label, ...(shorthand ? { shorthand } : {}) }];
  });
};

export const normalizeWorkspaceBadgeItems = (value: unknown): ExtensionWorkspaceBadgeItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const shorthand = textValue(item.shorthand);
    const name = textValue(item.name) ?? shorthand ?? id;
    const createdAt = textValue(item.createdAt);
    const ticketId = textValue(item.ticketId);
    const ticketLabel = textValue(item.ticketLabel);
    const ticketShorthand = textValue(item.ticketShorthand);
    const ticketBreadcrumb = normalizeTicketBreadcrumbItems(item.ticketBreadcrumb);
    return [
      {
        id,
        name,
        ...(shorthand ? { shorthand } : {}),
        type: workspaceTypeFrom(item.type),
        ...(createdAt ? { createdAt } : {}),
        ...(ticketId ? { ticketId } : {}),
        ...(ticketLabel ? { ticketLabel } : {}),
        ...(ticketShorthand ? { ticketShorthand } : {}),
        ...(ticketBreadcrumb.length > 0 ? { ticketBreadcrumb } : {}),
      },
    ];
  });
};

const workspaceTicketMetadata = (item: ExtensionWorkspaceBadgeItem) => ({
  ...(item.ticketId ? { ticketId: item.ticketId } : {}),
  ...(item.ticketLabel ? { ticketLabel: item.ticketLabel } : {}),
  ...(item.ticketShorthand ? { ticketShorthand: item.ticketShorthand } : {}),
  ...(item.ticketBreadcrumb && item.ticketBreadcrumb.length > 0 ? { ticketBreadcrumb: item.ticketBreadcrumb } : {}),
});

export const createWorkspaceBadgeResource = (item: ExtensionWorkspaceBadgeItem, projectId: string): ResourceRef =>
  createDashboardResource("workspace", item.id, item.name, "GitBranch", projectId, {
    workspaceId: item.id,
    workspaceType: item.type,
    ...(item.shorthand ? { workspaceShorthand: item.shorthand } : {}),
    ...workspaceTicketMetadata(item),
  });

const WorkspaceDiffTotals = (props: { workspaceId: string }) => {
  const { workspaceId } = props;
  const summary = getDashboardWorkspaceDiffSummary(workspaceId);

  if (!summary) return null;

  return <DiffBubble additions={summary.additions} deletions={summary.deletions} variant="ghost" size="small" />;
};

const stopWorkspaceBadgeRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

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
  const workspaceIdsKey = items.map((item) => item.id).join("\n");
  const selectedSummary = selectedItem ? getDashboardWorkspaceDiffSummary(selectedItem.id) : undefined;
  const badgeLabel = selectedItem?.shorthand ?? selectedItem?.name;

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
      workspaceType={selectedItem.type}
      shorthand={badgeLabel}
      diffAdditions={selectedSummary?.additions}
      diffDeletions={selectedSummary?.deletions}
      hasMultipleWorkspaces={items.length > 1}
      showLeadingSessionIndicator={false}
    />
  );

  if (items.length === 1) {
    return (
      <Box
        as="span"
        display="inline-flex"
        minW="0"
        cursor="pointer"
        {...createWorkspaceBadgeInteractionProps(() => openItem(selectedItem))}
      >
        {badge}
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
                label={item.name}
                icon={<Icon as={GitBranch} boxSize="16px" />}
                endContent={<WorkspaceDiffTotals workspaceId={item.id} />}
                onActivate={() => openItem(item)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

export const createWorkspaceBadgeRenderer =
  (input: { itemsAttributeId: string; projectId: string; openResource: (resource: ResourceRef) => void }) =>
  (value: unknown, row: DataRendererRow) => {
    const items = normalizeWorkspaceBadgeItems(row.attributes[input.itemsAttributeId]);
    if (items.length === 0) return null;
    return createElement(ExtensionWorkspaceBadgeDisplay, {
      items,
      projectId: input.projectId,
      value,
      openResource: input.openResource,
    });
  };
