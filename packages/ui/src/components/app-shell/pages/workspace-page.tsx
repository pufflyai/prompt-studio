import { Badge, Box, Button, Flex, HStack, Stack, Tabs, Text } from "@chakra-ui/react";
import { Check, FileDiffIcon, ListTree, Loader2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import { DiffDrawer } from "../../diff-drawer";
import { Header } from "../../header";
import { ResizableSplitLayout } from "../../resizable-split-layout";
import { ScrollArea } from "../../scroll-area";
import { FileTree } from "../file-tree";
import { mockChecks, mockDiffs } from "../mock-data";

const checkStatusIcon = (status: "passed" | "failed" | "running") => {
  if (status === "passed") return <Check size={14} color="var(--chakra-colors-fg-success)" />;
  if (status === "failed") return <X size={14} color="var(--chakra-colors-fg-error)" />;
  return <Loader2 size={14} />;
};

const ChecksPanel = () => (
  <Stack flex="1" minH="0" minW="0" gap="0">
    <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
      <Text textStyle="label/S/medium">Checks</Text>
    </Header>
    <Stack flex="1" minH="0" overflowY="auto" gap="0">
      {mockChecks.map((check) => (
        <HStack
          key={check.id}
          px="sm"
          py="xs"
          borderBottomWidth="1px"
          borderColor="border.muted"
          gap="sm"
          align="center"
        >
          {checkStatusIcon(check.status)}
          <Stack gap="0" flex="1" minW="0">
            <Text textStyle="label/M/regular">{check.name}</Text>
            <Text textStyle="label/XS" color="fg.muted" lineClamp={1}>
              {check.details}
            </Text>
          </Stack>
          <Badge
            variant="subtle"
            colorPalette={check.status === "passed" ? "green" : check.status === "failed" ? "red" : "yellow"}
          >
            {check.status}
          </Badge>
          <Text textStyle="label/XS" color="fg.muted" minW="3rem" textAlign="right">
            {check.duration}
          </Text>
        </HStack>
      ))}
    </Stack>
  </Stack>
);

const diffPaths = mockDiffs.map((diff) => diff.newPath ?? diff.oldPath ?? "unknown");

export const WorkspacePage = () => {
  const [isTreePanelOpen, setTreePanelOpen] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(diffPaths[0] ?? null);

  return (
    <Flex flex="1" minH="0" minW="0" bg="bg.subtle" gap="0">
      <Tabs.Root
        defaultValue="changes"
        variant="line"
        display="flex"
        flexDirection="column"
        h="full"
        minH="0"
        minW="0"
        flex="1"
        bg="bg.subtle"
        size="sm"
      >
        <Tabs.List h="2rem" minH="2rem" bg="bg.subtle" borderBottomWidth="1px" borderRadius={0} px="xs" py="0">
          <Tabs.Trigger value="changes" gap="2xs" h="2rem" minH="2rem">
            <FileDiffIcon size={14} />
            Changes
          </Tabs.Trigger>
          <Tabs.Trigger value="checks" gap="2xs" h="2rem" minH="2rem">
            <ShieldCheck size={14} />
            Checks
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="changes" flex="1" minH="0" minW="0" p="0" display="flex">
          <Flex flex="1" minH="0" minW="0" gap="0">
            <ResizableSplitLayout
              flex="1"
              minH="0"
              minW="0"
              resizablePanel={
                <Stack flex="1" minH="0" bg="bg" borderRightWidth="1px" borderColor="border.muted" gap="0">
                  <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
                    <Text textStyle="label/S/medium">Changed files</Text>
                  </Header>
                  <ScrollArea flex="1" minH="0">
                    <FileTree paths={diffPaths} selectedPath={selectedPath} onSelectPath={setSelectedPath} />
                  </ScrollArea>
                </Stack>
              }
              contentPanel={
                <Stack flex="1" minH="0" minW="0" gap="0">
                  <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
                    <Button size="xs" variant="ghost" gap="2xs" onClick={() => setTreePanelOpen((open) => !open)}>
                      <ListTree size={14} />
                      {isTreePanelOpen ? "Hide file tree" : "Show file tree"}
                    </Button>
                  </Header>
                  <Box flex="1" minH="0" minW="0">
                    <DiffDrawer diffs={mockDiffs} selectedDiffPath={selectedPath} />
                  </Box>
                </Stack>
              }
              collapsed={!isTreePanelOpen}
              defaultSizePx={280}
              minSizePx={220}
              maxSizePx={420}
              contentMinSizePx={320}
              resizeLabel="Resize file tree"
              showResizeSeparator={false}
              onCollapsedChange={(collapsed) => setTreePanelOpen(!collapsed)}
            />
          </Flex>
        </Tabs.Content>

        <Tabs.Content value="checks" flex="1" minH="0" minW="0" p="0" display="flex">
          <ChecksPanel />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
};
