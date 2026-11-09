import { Tabs } from "@chakra-ui/react";
import { ComparePage } from "../compare/compare-page";
import { RunsPage } from "../runs/runs-page";
import { TrendsPage } from "../trends/trends-page";

export const PerformancePage = () => (
  <Tabs.Root defaultValue="trends" lazyMount display="flex" flexDirection="column" h="full" minH="0">
    <Tabs.List flexShrink="0" px="md">
      <Tabs.Trigger value="trends">Trends</Tabs.Trigger>
      <Tabs.Trigger value="compare">Compare</Tabs.Trigger>
      <Tabs.Trigger value="runs">Runs</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="trends" flex="1" minH="0" p="0">
      <TrendsPage />
    </Tabs.Content>
    <Tabs.Content value="compare" flex="1" minH="0" p="0">
      <ComparePage />
    </Tabs.Content>
    <Tabs.Content value="runs" flex="1" minH="0" p="0">
      <RunsPage />
    </Tabs.Content>
  </Tabs.Root>
);
