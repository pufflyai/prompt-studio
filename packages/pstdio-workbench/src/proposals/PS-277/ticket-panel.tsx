import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { Header, WindowTabs } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import { WorkbenchIcon } from "../../react/shared/icon";
import { MenuHeader, MenuHeaderDropTargets } from "./menu-header";
import type { MenuHeaderSettings } from "./menu-header-state";
import { ResourceMenuLayout } from "./resource-menu-layout";
import { type ResourceState, tickets } from "./resource-navigation-content";

interface TicketPanelProps {
  presentation: "page" | "main" | "side" | "secondary";
  active: number;
  select: (index: number) => void;
  state: ResourceState;
  update: (change: Partial<ResourceState>) => void;
  header: MenuHeaderSettings;
  configureHeader: (settings: MenuHeaderSettings) => void;
}

export const TicketPanel = (props: TicketPanelProps) => {
  const { presentation, active, select, state, update, header, configureHeader } = props;
  const panel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [draggingHeader, setDraggingHeader] = useState(false);
  const page = presentation === "page";
  const ticket = tickets[active];
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.width < 600 || entry.contentRect.height < 360),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const menuHeader = (
    <MenuHeader
      settings={header}
      configure={configureHeader}
      state={state}
      update={update}
      compact={compact}
      onDragChange={setDraggingHeader}
    />
  );
  return (
    <Stack ref={panel} flex="1" h="full" minW="0" minH="0" gap="0" bg="bg" aria-label="Ticket panel">
      {page ? (
        <Header flexShrink="0" borderBottomWidth="1px" borderColor="border.subtle">
          <WorkbenchIcon name="ArrowLeft" />
          <Text textStyle="label/S" color="fg.muted">
            Planner
          </Text>
          <WorkbenchIcon name="ChevronRight" />
          <Text textStyle="label/S/medium" flex="1">
            {ticket.id}
          </Text>
          {tickets.map((item, index) => (
            <Button
              key={item.id}
              size="xs"
              variant="ghost"
              aria-pressed={active === index}
              onClick={() => select(index)}
            >
              {item.id}
            </Button>
          ))}
        </Header>
      ) : (
        <Header flexShrink="0" borderBottomWidth="1px" borderColor="border.subtle" aria-label="Ticket tabs">
          <Box flex="1" minW="0">
            <WindowTabs
              aria-label="Resource tabs"
              tabs={tickets.map((item) => ({
                id: item.id,
                label: item.id,
                closable: false,
                icon: <WorkbenchIcon name="Ticket" />,
              }))}
              selectedId={ticket.id}
              onSelect={(id) => select(tickets.findIndex((item) => item.id === id))}
              onClose={() => {}}
            />
          </Box>
          <WorkbenchIcon name={presentation === "secondary" ? "PanelBottom" : "Columns2"} />
        </Header>
      )}
      <Stack flex="1" minW="0" minH="0" gap="0" position="relative">
        {!compact && header.position === "top" ? menuHeader : null}
        <Flex flex="1" minW="0" minH="0">
          {!compact && header.position === "left" ? menuHeader : null}
          <ResourceMenuLayout
            ticket={ticket}
            state={state}
            update={update}
            page={page}
            compact={compact}
            headerPosition={header.position}
          />
          {!compact && header.position === "right" ? menuHeader : null}
        </Flex>
        {!compact && header.position === "bottom" ? menuHeader : null}
        {compact ? menuHeader : null}
        {draggingHeader ? (
          <MenuHeaderDropTargets settings={header} configure={configureHeader} onDragChange={setDraggingHeader} />
        ) : null}
      </Stack>
    </Stack>
  );
};
