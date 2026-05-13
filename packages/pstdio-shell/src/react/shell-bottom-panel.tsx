import { Box, Flex, HStack, Tabs, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import type { ShellCore, ShellWidgetPlacement } from "../core";
import type { ShellRendererRegistry } from "./renderer-registry";
import { ShellActivityFeed } from "./shell-activity-feed";
import { ShellDiagnosticsPanel } from "./shell-diagnostics-panel";
import { ShellIcon } from "./shell-icons";
import { ShellWidgetHost } from "./shell-widget-host";

interface ShellBottomPanelProps {
  shell: ShellCore;
  renderers: ShellRendererRegistry;
  onCommandError?: (error: unknown) => void;
  refresh: () => void;
}

interface BottomPanelTab {
  value: string;
  label: string;
  icon: string;
  count?: number;
  placement?: ShellWidgetPlacement;
  kind?: "diagnostics" | "activity";
}

const widgetTabValue = (placement: ShellWidgetPlacement) => `widget:${placement.widgetId}`;

const createBottomPanelTabs = (shell: ShellCore) => {
  const layout = shell.layout.getLayout();
  const diagnostics = shell.diagnostics.listDiagnostics();
  const activityItems = shell.activity.listItems();
  const tabs: BottomPanelTab[] = layout.areas["main-bottom"].widgets.map((placement) => {
    const widget = shell.layout.getWidget(placement.contributionId);

    return {
      value: widgetTabValue(placement),
      label: placement.title ?? widget?.title ?? placement.contributionId,
      icon: "PanelBottom",
      placement,
    };
  });

  if (diagnostics.length > 0) {
    tabs.push({
      value: "diagnostics",
      label: "Diagnostics",
      icon: "ListChecks",
      count: diagnostics.length,
      kind: "diagnostics",
    });
  }

  if (activityItems.length > 0) {
    tabs.push({
      value: "activity",
      label: "Activity",
      icon: "Activity",
      count: activityItems.length,
      kind: "activity",
    });
  }

  return tabs;
};

const resolveDefaultTabValue = (shell: ShellCore, tabs: BottomPanelTab[]) => {
  const activeWidgetId = shell.layout.getLayout().areas["main-bottom"].activeWidgetId;
  const activeWidgetTab = activeWidgetId ? tabs.find((tab) => tab.value === `widget:${activeWidgetId}`) : undefined;

  return activeWidgetTab?.value ?? tabs[0]?.value ?? "";
};

const BottomPanelTabTrigger = (props: { tab: BottomPanelTab }) => {
  const { tab } = props;

  return (
    <Tabs.Trigger value={tab.value} gap="2xs" h="2rem" minH="2rem">
      <ShellIcon name={tab.icon} size={14} />
      <Text as="span" truncate>
        {tab.label}
      </Text>
      {tab.count !== undefined ? (
        <Text as="span" textStyle="label/XS/regular" color="fg.muted">
          {tab.count}
        </Text>
      ) : null}
    </Tabs.Trigger>
  );
};

const BottomPanelTabContent = (props: {
  tab: BottomPanelTab;
  shell: ShellCore;
  renderers: ShellRendererRegistry;
  onCommandError?: (error: unknown) => void;
  refresh: () => void;
}) => {
  const { onCommandError, refresh, renderers, shell, tab } = props;

  return (
    <Tabs.Content value={tab.value} flex="1" minH="0" minW="0" p="0" display="flex">
      {tab.placement ? (
        <ShellWidgetHost shell={shell} placement={tab.placement} renderers={renderers} refresh={refresh} />
      ) : tab.kind === "diagnostics" ? (
        <ShellDiagnosticsPanel shell={shell} onCommandError={onCommandError} refresh={refresh} />
      ) : (
        <ShellActivityFeed shell={shell} />
      )}
    </Tabs.Content>
  );
};

export const ShellBottomPanel = (props: ShellBottomPanelProps) => {
  const { shell, renderers, onCommandError, refresh } = props;
  const tabs = createBottomPanelTabs(shell);
  const defaultTabValue = resolveDefaultTabValue(shell, tabs);
  const [selectedTabValue, setSelectedTabValue] = useState(defaultTabValue);
  const activeTabValue = tabs.some((tab) => tab.value === selectedTabValue) ? selectedTabValue : defaultTabValue;

  const selectTab = (value: string) => {
    const tab = tabs.find((candidate) => candidate.value === value);
    if (!tab) return;

    setSelectedTabValue(value);
    if (tab.placement) {
      shell.layout.activateWidget(tab.placement.widgetId);
      refresh();
    }
  };

  if (tabs.length === 0) return null;

  return (
    <Flex as="section" direction="column" h="full" minH="0" minW="0" bg="bg" overflow="hidden">
      <Tabs.Root
        value={activeTabValue}
        variant="line"
        display="flex"
        flexDirection="column"
        h="full"
        minH="0"
        minW="0"
        size="sm"
        onValueChange={(details) => selectTab(details.value)}
      >
        <HStack borderBottomWidth="1px" borderColor="border.muted" bg="bg.subtle" flexShrink={0} minH="2rem">
          <ScrollArea
            flex="1"
            h="2rem"
            minW="0"
            showHorizontalScrollbar
            showVerticalScrollbar={false}
            contentProps={{ minW: "max-content" }}
            viewportProps={{ h: "2rem", style: { overflowY: "hidden" } }}
          >
            <Tabs.List
              h="2rem"
              minH="2rem"
              bg="transparent"
              borderBottomWidth="0"
              borderRadius={0}
              minW="full"
              px="xs"
              py="0"
            >
              {tabs.map((tab) => (
                <BottomPanelTabTrigger key={tab.value} tab={tab} />
              ))}
            </Tabs.List>
          </ScrollArea>
        </HStack>
        <Box flex="1" minH="0" minW="0">
          {tabs.map((tab) => (
            <BottomPanelTabContent
              key={tab.value}
              tab={tab}
              shell={shell}
              renderers={renderers}
              onCommandError={onCommandError}
              refresh={refresh}
            />
          ))}
        </Box>
      </Tabs.Root>
    </Flex>
  );
};
