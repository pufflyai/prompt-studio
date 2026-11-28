import { HStack, Text } from "@chakra-ui/react";
import { Breadcrumb, type ResourceContextAction, Tooltip } from "@pstdio/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { WorkbenchBreadcrumbItem, WorkbenchCore } from "../../core";
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
const WorkbenchBreadcrumbIcon = (props: { item: WorkbenchBreadcrumbItem }) => {
  const { item } = props;
  const resource = item.icon === item.resource?.icon ? item.resource : undefined;
  return (
    <WorkbenchIcon
      name={item.icon}
      size={14}
      flexShrink={0}
      color={resource?.iconColor ?? "fg.muted"}
      role={resource?.iconLabel ? "img" : undefined}
      aria-label={resource?.iconLabel}
      aria-hidden={resource?.iconLabel ? undefined : true}
    />
  );
};
const WorkbenchBreadcrumbTitle = (props: { item: WorkbenchBreadcrumbItem; draggable?: boolean }) => {
  const { item, draggable } = props;
  const title = item.title as ReactNode;
  const labelRef = useRef<HTMLSpanElement>(null);
  const [clippedByTrail, setClippedByTrail] = useState(false);

  useEffect(() => {
    const label = labelRef.current;
    const trail = label?.closest("nav");
    if (!label || !trail) return;

    // The trail can crop an ancestor label that still fits inside its own element.
    const observer = new IntersectionObserver(
      ([entry]) => {
        setClippedByTrail(entry.intersectionRect.width < entry.boundingClientRect.width);
      },
      { root: trail, threshold: [0, 1] },
    );
    observer.observe(label);
    return () => observer.disconnect();
  }, []);

  return (
    <Tooltip content={title} overflowRef={clippedByTrail ? undefined : labelRef} positioning={{ placement: "bottom" }}>
      <HStack
        as="span"
        alignItems="center"
        gap="2xs"
        minW="0"
        data-workbench-page-drag-handle={draggable || undefined}
        css={
          draggable
            ? {
                "[data-workbench-page-drag][data-panel-draggable] &": { cursor: "grab", userSelect: "none" },
                "[data-workbench-page-drag][data-panel-dragging] &": { cursor: "grabbing" },
              }
            : undefined
        }
      >
        <WorkbenchBreadcrumbIcon item={item} />
        <Text asChild layerStyle="navigationLabel" minW="0" maxW="15rem" lineHeight="1.25rem" truncate>
          <span ref={labelRef}>{title}</span>
        </Text>
      </HStack>
    </Tooltip>
  );
};
export const buildWorkbenchBreadcrumbItems = (
  items: WorkbenchBreadcrumbItem[] | undefined,
  actionsForResource?: (item: WorkbenchBreadcrumbItem) => ResourceContextAction[] | undefined,
  draggable = false,
) =>
  (items ?? []).map((item, index) => {
    const actions = actionsForResource?.(item);
    return {
      title: <WorkbenchBreadcrumbTitle item={item} draggable={draggable && index === items!.length - 1} />,
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
  const crumbs = items.flatMap<WorkbenchBreadcrumbItem>((item) => {
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
        icon: projected.icon === item.resource.icon ? item.icon : projected.icon,
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
      icon:
        resource.icon ??
        resourcePresentation.icon ??
        workbench.resources.getKind(resource.type, resource.extensionId)?.icon,
      resource,
    });
  }
  return (
    <Breadcrumb
      onDragStartCapture={(event) => {
        const target = event.target as Element;
        const handle = "[data-workbench-page-drag-handle]";
        if (target.closest(handle) || target.querySelector(handle)) event.preventDefault();
      }}
      items={buildWorkbenchBreadcrumbItems(
        crumbs,
        (item) => [
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
        ],
        Boolean(content),
      )}
      separator="/"
      separatorGap="xs"
      display="flex"
      h="full"
    />
  );
};
