import { HStack, Text } from "@chakra-ui/react";
import { Breadcrumb, type ResourceContextAction, type SessionCompletionStatus, SessionIndicator } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchBreadcrumbItem, WorkbenchCore } from "../../core";
import { resolvePageBreadcrumbPlacement } from "../../core/registries/pages/page-active-placement";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { createWorkbenchResourceMenu } from "../menus/resource-menu";
import { WorkbenchIcon } from "../shared/icon";
import { usePlacementTab } from "../shared/use-placement-tab";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { breadcrumbSnapshot } from "./breadcrumb-snapshot";

interface WorkbenchBreadcrumbViewProps {
  workbench: WorkbenchCore;
}
const getSessionStatus = (item: WorkbenchBreadcrumbItem) =>
  typeof item.resource?.metadata?.status === "string"
    ? (item.resource.metadata.status as SessionCompletionStatus)
    : undefined;
const WorkbenchBreadcrumbIcon = (props: { item: WorkbenchBreadcrumbItem }) => {
  const { item } = props;
  const status = getSessionStatus(item);
  if (item.indicator === "session-status" || item.resource?.type === "session") {
    return <SessionIndicator status={status} boxSize="14px" />;
  }
  if (!item.icon) return null;
  return (
    <Text as="span" aria-hidden="true" color="fg.muted" display="inline-flex" flexShrink={0}>
      <WorkbenchIcon name={item.icon} size={14} />
    </Text>
  );
};
const WorkbenchBreadcrumbTitle = (props: { item: WorkbenchBreadcrumbItem }) => {
  const { item } = props;
  const title = item.title as ReactNode;
  return (
    <HStack as="span" gap="2xs" minW="0">
      <WorkbenchBreadcrumbIcon item={item} />
      <Text as="span" minW="0" maxW="15rem" truncate>
        {title}
      </Text>
    </HStack>
  );
};
export const buildWorkbenchBreadcrumbItems = (
  items: WorkbenchBreadcrumbItem[] | undefined,
  actionsForResource?: (item: WorkbenchBreadcrumbItem) => ResourceContextAction[] | undefined,
) =>
  (items ?? []).map((item) => {
    const actions = actionsForResource?.(item);
    return {
      title: <WorkbenchBreadcrumbTitle item={item} />,
      url: item.url,
      onClick: item.onClick,
      ...(actions?.length ? { contextMenuActions: actions } : {}),
    };
  });
export const WorkbenchBreadcrumbView = (props: WorkbenchBreadcrumbViewProps) => {
  const { workbench } = props;
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const items = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const page = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const placement = useWorkbenchStore(workbench.layout.store, (state) =>
    resolvePageBreadcrumbPlacement(state.layout, page),
  );
  const snapshot = usePlacementTab(placement, workbench);
  useWorkbenchResourceActionResolver(workbench);
  if (items.length === 0) return null;
  const resource = placement?.resource;
  const crumbs = items.flatMap((item) => {
    if (!item.resource) return [item];
    const projected = resolveResourcePreview(item.resource, changes);
    if (!projected) return [];
    return [{ ...item, resource: projected, title: projected !== item.resource ? projected.label : item.title }];
  });
  if (
    resource &&
    resolveResourcePreview(resource, changes) &&
    !crumbs.some(
      (item) =>
        item.resource &&
        workbench.pages.resourceReferenceKey(item.resource) === workbench.pages.resourceReferenceKey(resource),
    )
  ) {
    crumbs.push({
      title: snapshot.label ?? resource.label ?? resource.id,
      icon: snapshot.icon ?? workbench.resources.getKind(resource.type, resource.extensionId)?.icon,
      resource,
    });
  }
  return (
    <Breadcrumb
      items={buildWorkbenchBreadcrumbItems(crumbs, (item) =>
        item.resource
          ? createWorkbenchResourceMenu(
              workbench,
              item.resource,
              breadcrumbSnapshot(item, crumbs.at(-1), resource, snapshot, workbench.pages.resourceReferenceKey),
            )
          : undefined,
      )}
      separator="/"
      separatorGap="xs"
      display="flex"
      h="full"
    />
  );
};
