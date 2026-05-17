import { Badge, HStack, Tabs, Text } from "@chakra-ui/react";
import { DiffViewer, ScrollArea } from "@pstdio/ui";
import { FileDiff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { dashboardChangedFilePaths, dashboardChecks, dashboardWorkspaceDiffs } from "../mock-data/data";

type DashboardWorkspaceTab = "changes" | "checks";

const ChecksPanel = () => (
  <ScrollArea flex="1" minH="0" contentProps={{ p: "sm", spaceY: "xs" }}>
    {dashboardChecks.map((check) => (
      <HStack key={check.id} gap="sm" py="xs" borderBottomWidth="1px" borderColor="border.muted">
        <ShieldCheck size={15} />
        <Text textStyle="label/S/regular" flex="1">
          {check.label}
        </Text>
        <Badge colorPalette={check.status === "passed" ? "green" : "blue"} variant="subtle">
          {check.status}
        </Badge>
      </HStack>
    ))}
  </ScrollArea>
);

export const WorkspaceDetailTabs = () => {
  const [activeTab, setActiveTab] = useState<DashboardWorkspaceTab>("changes");

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(details) => setActiveTab(details.value as DashboardWorkspaceTab)}
      variant="line"
      display="flex"
      flexDirection="column"
      h="full"
      minH="0"
      minW="0"
      flex="1"
      size="sm"
    >
      <Tabs.List bg="bg.subtle" borderBottomWidth="1px" borderColor="border.muted" px="xs">
        <Tabs.Trigger value="changes" gap="2xs">
          <FileDiff size={14} />
          Changes
        </Tabs.Trigger>
        <Tabs.Trigger value="checks" gap="2xs">
          <ShieldCheck size={14} />
          Checks
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="changes" flex="1" minH="0" minW="0" p="0" display="flex">
        <DiffViewer
          diffs={dashboardWorkspaceDiffs}
          changedFilePaths={dashboardChangedFilePaths}
          defaultSelectedPath={dashboardWorkspaceDiffs[0]?.newPath}
        />
      </Tabs.Content>
      <Tabs.Content value="checks" flex="1" minH="0" minW="0" p="0" display="flex">
        <ChecksPanel />
      </Tabs.Content>
    </Tabs.Root>
  );
};
