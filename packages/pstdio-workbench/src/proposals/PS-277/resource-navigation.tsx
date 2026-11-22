import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Header, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchIcon } from "../../react/shared/icon";
import { initialMenuHeader } from "./menu-header-state";
import { ResourceMenuGroup } from "./resource-menu-group";
import { menuLayout } from "./resource-menu-state";
import {
  CollectionContent,
  initialResourceState,
  ProjectNavigation,
  type ResourceState,
  tickets,
} from "./resource-navigation-content";
import { TicketPanel } from "./ticket-panel";

type Presentation = "page" | "main" | "side" | "secondary";
const presentations: { id: Presentation; label: string }[] = [
  { id: "page", label: "Page" },
  { id: "main", label: "Main tab" },
  { id: "side", label: "Side tab" },
  { id: "secondary", label: "Secondary tab" },
];

const TimelinePanel = () => (
  <Stack flex="1" minW="0" minH="0" gap="0" bg="bg">
    <Header borderBottomWidth="1px" borderColor="border.subtle" flexShrink="0">
      <WorkbenchIcon name="ArrowLeft" />
      <Text textStyle="label/S/medium">Planner</Text>
      <WorkbenchIcon name="ChevronRight" />
      <Text textStyle="label/S">Project timeline</Text>
    </Header>
    <ScrollArea flex="1" minH="0">
      <CollectionContent />
    </ScrollArea>
  </Stack>
);

export const ResourceNavigation = () => {
  const [presentation, setPresentation] = useState<Presentation>("main");
  const [active, setActive] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [header, configureHeader] = useState(initialMenuHeader);
  const [resources, setResources] = useState(() => tickets.map(initialResourceState));
  const state = resources[active];
  const update = (change: Partial<ResourceState>) =>
    setResources((current) => current.map((value, index) => (index === active ? { ...value, ...change } : value)));
  const page = presentation === "page";
  const auxiliary = presentation === "side" || presentation === "secondary";
  const panel = (
    <TicketPanel
      presentation={presentation}
      active={active}
      select={setActive}
      state={state}
      update={update}
      header={header}
      configureHeader={configureHeader}
    />
  );
  return (
    <Stack h="100dvh" minH="0" gap="sm" p="sm" bg="bg.muted" color="fg">
      <HStack gap="sm" flexWrap="wrap" flexShrink="0" aria-label="Prototype controls">
        <Text textStyle="label/XS" color="fg.muted">
          Move ticket to
        </Text>
        {presentations.map((item) => (
          <Button
            key={item.id}
            size="xs"
            variant={presentation === item.id ? "primary" : "ghost"}
            aria-pressed={presentation === item.id}
            onClick={() => setPresentation(item.id)}
          >
            {item.label}
          </Button>
        ))}
        <Box flex="1" />
        <Button
          size="xs"
          variant="ghost"
          aria-pressed={narrow}
          disabled={presentation !== "side"}
          onClick={() => setNarrow(!narrow)}
        >
          Narrow Side panel
        </Button>
      </HStack>
      <HStack gap="sm" flexWrap="wrap" flexShrink="0" aria-label="Menu layout controls">
        <Text textStyle="label/XS" color="fg.muted">
          Menus
        </Text>
        {(["split", "left", "right", "bottom"] as const).map((layout) => (
          <Button key={layout} size="xs" variant="ghost" onClick={() => update(menuLayout(layout, state.menuPolicy))}>
            {layout === "split" ? "Separate sides" : `All ${layout}`}
          </Button>
        ))}
        <Button
          size="xs"
          variant="ghost"
          aria-pressed={state.menuPolicy === "multiple"}
          onClick={() =>
            setResources((current) =>
              current.map((value) => {
                const menuPolicy = state.menuPolicy === "single" ? "multiple" : "single";
                const active = value.focusedMenu ?? Object.values(value.activeMenus).find(Boolean);
                const singleMenu = active ? { [value.menuPositions[active]]: active } : {};
                const activeMenus = menuPolicy === "single" ? singleMenu : value.activeMenus;
                return { ...value, menuPolicy, activeMenus };
              }),
            )
          }
        >
          {state.menuPolicy === "single" ? "One menu · Prompt Studio default" : "Multiple menus · Custom configuration"}
        </Button>
      </HStack>
      <Flex
        flex="1"
        minH="0"
        flexDirection="column"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="xs"
        overflow="hidden"
        bg="bg"
      >
        <Header flexShrink="0" borderBottomWidth="1px" borderColor="border.subtle">
          <WorkbenchIcon name="Blocks" />
          <Text textStyle="label/S/medium">Prompt Studio</Text>
          <WorkbenchIcon name="ChevronDown" />
          <Box flex="1" />
          <WorkbenchIcon name="PanelLeft" />
          <WorkbenchIcon name="PanelBottom" />
          <WorkbenchIcon name="PanelRight" />
        </Header>
        <Flex flex="1" minH="0">
          <Box
            w="56"
            flexShrink="0"
            borderRightWidth="1px"
            borderColor="border.subtle"
            minH="0"
            aria-label="Application navigation"
          >
            {page && state.activeMenus.left ? (
              <ResourceMenuGroup ticket={tickets[active]} state={state} update={update} side="left" />
            ) : (
              <ProjectNavigation />
            )}
          </Box>
          {auxiliary ? (
            <Flex flex="1" minW="0" minH="0" direction={presentation === "secondary" ? "column" : "row"}>
              <TimelinePanel />
              <Flex
                w={presentation === "side" && narrow ? "96" : undefined}
                flex={presentation === "side" && narrow ? undefined : "2"}
                h={presentation === "secondary" ? "lg" : undefined}
                flexShrink="0"
                minW="0"
                minH="0"
                borderLeftWidth={presentation === "side" ? "1px" : "0"}
                borderTopWidth={presentation === "secondary" ? "1px" : "0"}
                borderColor="border.subtle"
              >
                {panel}
              </Flex>
            </Flex>
          ) : (
            panel
          )}
        </Flex>
      </Flex>
      <Text textStyle="label/XS" color="fg.muted" flexShrink="0">
        Move the menu header from empty space or its context menu. Drag its icons to reorder, or use Alt + arrow keys.
        Narrow the Side panel to try floating bubbles.
      </Text>
    </Stack>
  );
};
