import { HStack, Text } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { ShellCore, ShellLayout, ShellWidgetPlacement } from "../core";
import { ShellIcon } from "./shell-icons";

const findActivePlacement = (layout: ShellLayout) => {
  for (const area of Object.values(layout.areas)) {
    const placement = area.widgets.find((candidate) => candidate.widgetId === layout.activeWidgetId);
    if (placement) return placement;
  }

  return undefined;
};

const ShellBreadcrumbTitle = (props: { icon?: string; title: ReactNode }) => {
  const { icon, title } = props;

  return (
    <HStack as="span" gap="2xs" minW="0">
      {icon ? (
        <Text as="span" aria-hidden="true" color="fg.muted" display="inline-flex" flexShrink={0}>
          <ShellIcon name={icon} size={14} />
        </Text>
      ) : null}
      <Text as="span" minW="0" truncate>
        {title}
      </Text>
    </HStack>
  );
};

const resolvePlacementIcon = (shell: ShellCore, placement?: ShellWidgetPlacement) => {
  if (!placement) return "KanbanSquare";
  if (placement.resource?.icon) return placement.resource.icon;
  if (placement.resource?.kind) return shell.resources.getKind(placement.resource.kind)?.icon;
  return undefined;
};

const buildBreadcrumbItem = (shell: ShellCore, placement: ShellWidgetPlacement, refresh: () => void) => ({
  title: (
    <ShellBreadcrumbTitle
      icon={resolvePlacementIcon(shell, placement)}
      title={placement.resource?.label ?? placement.title ?? placement.contributionId}
    />
  ),
  onClick: () => {
    if (placement.resource) {
      void shell.resources.openResource(placement.resource).then(refresh);
      return;
    }

    shell.layout.activateWidget(placement.widgetId);
    refresh();
  },
});

export const buildWorkbenchBreadcrumbItems = (
  shell: ShellCore,
  layout: ShellLayout,
  refresh: () => void,
  breadcrumbItems?: BreadcrumbItem[],
) => {
  if (breadcrumbItems?.length) return breadcrumbItems;

  const activePlacement = findActivePlacement(layout);
  if (!activePlacement) {
    return [{ title: <ShellBreadcrumbTitle icon="KanbanSquare" title="Workbench" /> }];
  }

  const parentPlacement = layout.areas.main.widgets.find(
    (placement) =>
      (placement.resource?.kind === "project" || placement.resource?.kind === "dashboard-view") &&
      placement.widgetId !== activePlacement.widgetId,
  );

  return parentPlacement
    ? [buildBreadcrumbItem(shell, parentPlacement, refresh), buildBreadcrumbItem(shell, activePlacement, refresh)]
    : [buildBreadcrumbItem(shell, activePlacement, refresh)];
};
