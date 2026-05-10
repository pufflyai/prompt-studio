import { Box, Flex, Text } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ExtensionMenuSlot } from "@/shared/extensions/components/extension-menu-slot";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";

interface DashboardHeaderProps {
  title: ReactNode;
  sidebarStorageKey: string;
  children?: ReactNode;
}

export const DashboardHeader = (props: DashboardHeaderProps) => {
  const { title, sidebarStorageKey, children } = props;
  const { projectId } = useParams({ strict: false });

  return (
    <Header variant="main" gap="sm" width="100%" borderBottomWidth="1px" borderColor="border.muted">
      <OpenSidebarButton storageKey={sidebarStorageKey} />
      {typeof title === "string" ? (
        <Text textStyle="label/M/medium" flexShrink={0}>
          {title}
        </Text>
      ) : (
        <Box flexShrink={0}>{title}</Box>
      )}
      <Flex flex="1" align="center" justify="flex-end" gap="sm" minW="0">
        {projectId ? <ExtensionMenuSlot slotId="project.headerPrimary" mode="buttons" /> : null}
        {children}
        {projectId ? <ExtensionMenuSlot slotId="project.headerOverflow" mode="overflow" /> : null}
      </Flex>
    </Header>
  );
};
