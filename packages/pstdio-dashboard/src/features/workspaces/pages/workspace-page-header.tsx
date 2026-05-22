import { Flex, HStack } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ExtensionMenuSlot } from "@/shared/extensions/components/extension-menu-slot";
import type { ExtensionResourceContext } from "@/shared/extensions/types";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";

interface WorkspacePageHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  children: ReactNode;
  extensionResource?: ExtensionResourceContext;
  sidebarStorageKey: string;
}

export const WorkspacePageHeader = (props: WorkspacePageHeaderProps) => {
  const { breadcrumbItems, children, extensionResource, sidebarStorageKey } = props;

  return (
    <HorizontalMenuStack>
      <Flex align="center" gap="sm" minW="0">
        <OpenSidebarButton storageKey={sidebarStorageKey} />
        <Breadcrumb separator="/" separatorGap="xs" linkComponent={Link} items={breadcrumbItems} />
      </Flex>

      <HStack gap="2xs" flexShrink={0}>
        <ExtensionMenuSlot
          slotId="workspace.headerPrimary"
          mode="buttons"
          resource={extensionResource}
          enabled={Boolean(extensionResource)}
        />
        {children}
      </HStack>
    </HorizontalMenuStack>
  );
};
