import { Box, Icon, Menu } from "@chakra-ui/react";
import type { DataRendererRow } from "@pstdio/ui";
import { DiffBubble, ListRow, WorkspaceBadge, type WorkspaceBadgeProps } from "@pstdio/ui";
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
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const workspaceTypeFrom = (value: unknown): ExtensionWorkspaceBadgeItem["type"] =>
  value === "current_branch" ? "current_branch" : "worktree";

export const normalizeWorkspaceBadgeItems = (value: unknown): ExtensionWorkspaceBadgeItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const shorthand = textValue(item.shorthand);
    const name = textValue(item.name) ?? shorthand ?? id;
    const createdAt = textValue(item.createdAt);
    return [
      {
        id,
        name,
        ...(shorthand ? { shorthand } : {}),
        type: workspaceTypeFrom(item.type),
        ...(createdAt ? { createdAt } : {}),
      },
    ];
  });
};

export const createWorkspaceBadgeResource = (item: ExtensionWorkspaceBadgeItem, projectId: string): ResourceRef =>
  createDashboardResource("workspace", item.id, item.name, "GitBranch", projectId, {
    workspaceId: item.id,
    workspaceType: item.type,
    ...(item.shorthand ? { workspaceShorthand: item.shorthand } : {}),
  });

const WorkspaceDiffTotals = (props: { workspaceId: string }) => {
  const { workspaceId } = props;
  const summary = getDashboardWorkspaceDiffSummary(workspaceId);

  if (!summary) return null;

  return <DiffBubble additions={summary.additions} deletions={summary.deletions} variant="ghost" size="small" />;
};

const stopRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

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
      onClick={items.length === 1 ? () => openItem(selectedItem) : undefined}
    />
  );

  if (items.length === 1) return badge;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Box
          as="span"
          display="inline-flex"
          minW="0"
          onClick={stopRowActivation}
          onPointerDown={stopRowActivation}
          onKeyDown={stopRowActivation}
        >
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
