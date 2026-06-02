import { HStack, Text } from "@chakra-ui/react";
import { Breadcrumb, type SessionCompletionStatus, SessionIndicator } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchBreadcrumbItem, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchBreadcrumbViewProps {
  workbench: WorkbenchCore;
}

const getSessionStatus = (item: WorkbenchBreadcrumbItem) =>
  item.resource?.kind === "session" && typeof item.resource.metadata?.status === "string"
    ? (item.resource.metadata.status as SessionCompletionStatus)
    : undefined;

const WorkbenchBreadcrumbIcon = (props: { item: WorkbenchBreadcrumbItem }) => {
  const { item } = props;
  const status = getSessionStatus(item);

  if (item.resource?.kind === "session") {
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
      <Text as="span" minW="0" truncate>
        {title}
      </Text>
    </HStack>
  );
};

export const buildWorkbenchBreadcrumbItems = (items: WorkbenchBreadcrumbItem[] | undefined) =>
  (items ?? []).map((item) => ({
    title: <WorkbenchBreadcrumbTitle item={item} />,
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
