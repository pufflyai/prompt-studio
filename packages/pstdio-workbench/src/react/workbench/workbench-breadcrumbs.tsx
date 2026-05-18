import { HStack, Text } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { FavoriteScopeInput, ResourceRef, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";

const WorkbenchBreadcrumbTitle = (props: { icon?: string; title: ReactNode }) => {
  const { icon, title } = props;

  return (
    <HStack as="span" gap="2xs" minW="0">
      {icon ? (
        <Text as="span" aria-hidden="true" color="fg.muted" display="inline-flex" flexShrink={0}>
          <WorkbenchIcon name={icon} size={14} />
        </Text>
      ) : null}
      <Text as="span" minW="0" truncate>
        {title}
      </Text>
    </HStack>
  );
};

const resolveFavoriteScope = (resource: ResourceRef): FavoriteScopeInput & { scope: "user" | "project" } => {
  const scope = resource.metadata?.favoriteScope as FavoriteScopeInput | undefined;
  return { scope: scope?.scope ?? "user", projectId: scope?.projectId };
};

const addBreadcrumbResourceToFavorites = async (workbench: WorkbenchCore, resource: ResourceRef) => {
  const scope = resolveFavoriteScope(resource);
  if (await workbench.favorites.isFavorited(resource, scope)) return;
  await workbench.favorites.add({ target: resource, ...scope });
};

const createBreadcrumbContextMenuActions = (workbench: WorkbenchCore, resource: ResourceRef | undefined) => {
  if (!resource) return undefined;

  return [
    {
      key: "favorites.addBreadcrumbResource",
      label: "Add to Favorites",
      icon: <WorkbenchIcon name="Star" />,
      onClick: () => addBreadcrumbResourceToFavorites(workbench, resource),
    },
  ];
};

export const buildWorkbenchBreadcrumbItems = (workbench: WorkbenchCore): BreadcrumbItem[] => {
  const items = workbench.breadcrumbs.getItems() ?? [];
  return items.map((item) => ({
    title: <WorkbenchBreadcrumbTitle icon={item.icon} title={item.title as ReactNode} />,
    url: item.url,
    onClick: item.onClick,
    contextMenuActions: createBreadcrumbContextMenuActions(workbench, item.resource),
  }));
};
