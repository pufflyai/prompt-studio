import { HStack, Text } from "@chakra-ui/react";
import { Breadcrumb } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchBreadcrumbItem, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchBreadcrumbViewProps {
  workbench: WorkbenchCore;
}

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

export const buildWorkbenchBreadcrumbItems = (items: WorkbenchBreadcrumbItem[] | undefined) =>
  (items ?? []).map((item) => ({
    title: <WorkbenchBreadcrumbTitle icon={item.icon} title={item.title as ReactNode} />,
    url: item.url,
    onClick: item.onClick,
  }));

export const WorkbenchBreadcrumbView = (props: WorkbenchBreadcrumbViewProps) => {
  const { workbench } = props;
  const items = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];

  if (items.length === 0) return null;

  return (
    <Breadcrumb items={buildWorkbenchBreadcrumbItems(items)} separator="/" separatorGap="xs" display="flex" h="full" />
  );
};
