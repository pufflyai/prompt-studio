import { HStack, Text } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import type { ReactNode } from "react";
import { buildActiveWidgetBreadcrumb, type ShellCore } from "../../core";
import { ShellIcon } from "../shared/icon";

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

export const buildWorkbenchBreadcrumbItems = (shell: ShellCore): BreadcrumbItem[] => {
  const items = shell.breadcrumbs.getItems() ?? buildActiveWidgetBreadcrumb(shell);
  return items.map((item) => ({
    title: <ShellBreadcrumbTitle icon={item.icon} title={item.title as ReactNode} />,
    url: item.url,
    onClick: item.onClick,
  }));
};
