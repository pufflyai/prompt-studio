import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import type { ShellArea as ShellAreaId, ShellCore, ShellWidgetPlacement } from "../core";
import { ShellWidgetHost } from "./shell-widget-host";

interface ShellAreaProps {
  shell: ShellCore;
  area: ShellAreaId;
  title?: string;
  emptyTitle?: string;
  showHeader?: boolean;
  hideSingleTabHeader?: boolean;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
  refresh?: () => void;
}

const getActivePlacement = (widgets: ShellWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

export const ShellArea = (props: ShellAreaProps) => {
  const {
    shell,
    area,
    title,
    emptyTitle = "No widgets open",
    showHeader = true,
    hideSingleTabHeader = true,
    pointerEvents = "auto",
    transparent = false,
    refresh = () => undefined,
  } = props;
  const areaState = shell.layout.getLayout().areas[area];
  const activePlacement = getActivePlacement(areaState.widgets, areaState.activeWidgetId);
  const shouldShowHeader =
    showHeader &&
    (areaState.widgets.length > 1 ||
      hideSingleTabHeader === false ||
      (areaState.widgets.length === 0 && Boolean(title)));

  const activate = (placement: ShellWidgetPlacement) => {
    shell.layout.activateWidget(placement.widgetId);
    refresh();
  };

  return (
    <Flex
      as="section"
      direction="column"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg={transparent ? "transparent" : "bg"}
      overflow="hidden"
      pointerEvents={pointerEvents}
      aria-label={title ?? area}
    >
      {shouldShowHeader ? (
        <ScrollArea
          borderBottomWidth="1px"
          borderColor="border.muted"
          flexShrink={0}
          minH="2.25rem"
          showHorizontalScrollbar
          showVerticalScrollbar={false}
          contentProps={{ minW: "max-content" }}
          viewportProps={{ minH: "2.25rem", style: { overflowY: "hidden" } }}
        >
          <HStack gap="2xs" minH="2.25rem" minW="full" px="xs">
            {title ? (
              <Text textStyle="label/XS/medium" color="fg.muted" flexShrink={0} mr="2xs">
                {title}
              </Text>
            ) : null}
            {areaState.widgets.map((placement) => (
              <Button
                key={placement.widgetId}
                size="2xs"
                variant={placement.widgetId === activePlacement?.widgetId ? "subtle" : "ghost"}
                colorPalette="gray"
                maxW="12rem"
                minW="0"
                px="xs"
                title={placement.title}
                onClick={() => activate(placement)}
              >
                <Text as="span" truncate>
                  {placement.title ?? placement.contributionId}
                </Text>
              </Button>
            ))}
          </HStack>
        </ScrollArea>
      ) : null}
      <Box flex="1" h="full" minH="0" minW="0" w="full" overflow="hidden">
        {activePlacement ? (
          <ShellWidgetHost shell={shell} placement={activePlacement} refresh={refresh} />
        ) : (
          <ScrollArea height="100%">
            <EmptyState minH="100%" title={emptyTitle} />
          </ScrollArea>
        )}
      </Box>
    </Flex>
  );
};
