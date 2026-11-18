import { HStack, Text } from "@chakra-ui/react";
import { Breadcrumb, type ResourceContextAction, type SessionCompletionStatus, SessionIndicator } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchBreadcrumbItem, WorkbenchCore, WorkbenchTabSnapshot } from "../../core";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { createWorkbenchResourceMenu } from "../menus/resource-menu";
import { WorkbenchIcon } from "../shared/icon";
import { placementMenuActions } from "../shared/placement-menu-actions";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { breadcrumbSnapshot } from "./breadcrumb-snapshot";
import { useBreadcrumbPlacement } from "./use-breadcrumb-placement";

interface WorkbenchBreadcrumbViewProps {
  workbench: WorkbenchCore;
}
type BreadcrumbTitleItem = WorkbenchBreadcrumbItem & {
  placementIndicator?: WorkbenchTabSnapshot["indicator"];
};

const getSessionStatus = (item: WorkbenchBreadcrumbItem) =>
  typeof item.resource?.metadata?.status === "string"
    ? (item.resource.metadata.status as SessionCompletionStatus)
    : undefined;
const WorkbenchBreadcrumbIcon = (props: { item: BreadcrumbTitleItem }) => {
  const { item } = props;
  const indicator = item.placementIndicator;
  if (indicator) {
    return (
      <WorkbenchIcon
        name={indicator.icon}
        size={14}
        flexShrink={0}
        color={indicator.color ?? "fg.muted"}
        role={indicator.label ? "img" : undefined}
        aria-label={indicator.label}
        aria-hidden={indicator.label ? undefined : true}
      />
    );
  }
  if (item.indicator === "session-status") {
    return <SessionIndicator status={getSessionStatus(item)} boxSize="14px" />;
  }
  if (!item.icon) return null;
  return (
    <Text as="span" aria-hidden="true" color="fg.muted" display="inline-flex" flexShrink={0}>
      <WorkbenchIcon name={item.icon} size={14} />
    </Text>
  );
};
const WorkbenchBreadcrumbTitle = (props: { item: BreadcrumbTitleItem }) => {
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
  items: BreadcrumbTitleItem[] | undefined,
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
  const { placement, content, snapshot, resourcePresentation } = useBreadcrumbPlacement(workbench);
  useWorkbenchResourceActionResolver(workbench);
  if (items.length === 0) return null;
  const resource = placement?.resource;
  const crumbs = items.flatMap<BreadcrumbTitleItem>((item) => {
    if (!item.resource) return [item];
    const projected = resolveResourcePreview(item.resource, changes);
    if (!projected) return [];
    const current = breadcrumbSnapshot(
      item,
      items.at(-1),
      resource,
      resourcePresentation,
      workbench.pages.resourceReferenceKey,
    );
    return [
      {
        ...item,
        resource: projected,
        title: projected !== item.resource ? projected.label : (current.label ?? item.title),
        icon: (projected !== item.resource ? projected.icon : undefined) ?? current.icon ?? item.icon,
        placementIndicator: current.indicator,
      },
    ];
  });
  if (content && !resource && crumbs.length && snapshot.label && snapshot.label !== crumbs.at(-1)?.title) {
    crumbs.push({ title: snapshot.label, icon: snapshot.icon ?? crumbs.at(-1)?.icon });
  }
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
      title: resourcePresentation.label ?? resource.label ?? resource.id,
      icon: resourcePresentation.icon ?? workbench.resources.getKind(resource.type, resource.extensionId)?.icon,
      placementIndicator: resourcePresentation.indicator,
      resource,
    });
  }
  return (
    <Breadcrumb
      items={buildWorkbenchBreadcrumbItems(crumbs, (item) => [
        ...(item.resource || item === crumbs.at(-1)
          ? createWorkbenchResourceMenu(
              workbench,
              item.resource,
              !resource && item === crumbs.at(-1)
                ? snapshot
                : breadcrumbSnapshot(item, crumbs.at(-1), resource, snapshot, workbench.pages.resourceReferenceKey),
              item === crumbs.at(-1) ? placement : undefined,
            )
          : []),
        ...placementMenuActions(
          workbench,
          { menu: item.menu },
          item.resource,
          item === crumbs.at(-1) ? placement : undefined,
        ),
      ])}
      separator="/"
      separatorGap="xs"
      display="flex"
      h="full"
    />
  );
};
