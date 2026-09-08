import { Box, Flex, Icon, IconButton, Text } from "@chakra-ui/react";
import { PanelBottom, PanelRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { PANEL_HEADER_CONTROL_SIZE } from "@/components/layout/panel-header.constants";
import { PrototypeResizeHandle } from "@/components/layout/panel-shell-prototype.handle";
import {
  ActivityRail,
  PanelCard,
  type PrototypeRadius,
  SizedSlot,
  StatusTray,
} from "@/components/layout/panel-shell-prototype.parts";
import { usePrototypePanelSize } from "@/components/layout/panel-shell-prototype.size";

// Prototype of the panel chrome redesign, reviewed in Storybook before the real
// implementation. Resizable regions render as rounded cards with a gap between
// them. Fixed chrome (activity rail, header row, status tray) sits flat on the
// background with no borders.

export type PrototypeGap = "3xs" | "2xs" | "xs";
export type { PrototypeRadius };

export interface PanelShellPrototypeProps {
  gap: PrototypeGap;
  radius: PrototypeRadius;
  hoverDelayMs: number;
  showPanelBorders: boolean;
  showSecondaryPanel: boolean;
  showSidePanel: boolean;
  sidenavCollapsed: boolean;
  secondaryCollapsed: boolean;
  sidePanelCollapsed: boolean;
}

export const PanelShellPrototype = (props: PanelShellPrototypeProps) => {
  const {
    gap,
    radius,
    hoverDelayMs,
    showPanelBorders,
    showSecondaryPanel,
    showSidePanel,
    sidenavCollapsed,
    secondaryCollapsed,
    sidePanelCollapsed,
  } = props;
  const sidenav = usePrototypePanelSize({
    initial: 240,
    min: 160,
    max: 480,
    direction: 1,
    collapsed: sidenavCollapsed,
  });
  const secondary = usePrototypePanelSize({
    initial: 200,
    min: 96,
    max: 480,
    direction: -1,
    collapsed: secondaryCollapsed,
  });
  const sidePanel = usePrototypePanelSize({
    initial: 320,
    min: 240,
    max: 560,
    direction: -1,
    collapsed: sidePanelCollapsed,
  });
  // The separator is the gap: it fills the space between two cards.
  const separatorSize = `var(--chakra-spacing-${gap})`;
  const cardProps = { radius, bordered: showPanelBorders };

  return (
    <Flex direction="column" h="full" w="full" minH="0" minW="0" bg="bg" color="fg" overflow="hidden">
      <Flex flex="1" minH="0" minW="0">
        <ActivityRail sidenavCollapsed={sidenav.collapsed} onToggleSidenav={sidenav.toggle} />
        <Flex flex="1" minH="0" minW="0" py={gap} pr={gap}>
          <SizedSlot width={sidenav.size} collapsed={sidenav.collapsed}>
            <PanelCard title="Sidenav" description="project · resizable" bg="bg.subtle" {...cardProps} />
          </SizedSlot>
          <PrototypeResizeHandle
            orientation="vertical"
            label="Resize sidenav"
            size={separatorSize}
            hoverDelayMs={hoverDelayMs}
            onResizeStart={sidenav.startDrag}
            onResize={sidenav.drag}
            onStep={sidenav.step}
            onToggle={sidenav.toggle}
          />
          <Flex direction="column" flex="1" minH="0" minW="0">
            <Header variant="main" flexShrink={0} px="xs">
              <Text textStyle="label/M/medium" color="fg" truncate>
                workspace A
              </Text>
              <Flex marginInlineStart="auto" gap="2xs">
                {showSecondaryPanel ? (
                  <IconButton
                    size={PANEL_HEADER_CONTROL_SIZE}
                    variant="ghost"
                    aria-label="Toggle secondary panel"
                    aria-pressed={!secondary.collapsed}
                    onClick={secondary.toggle}
                  >
                    <Icon as={PanelBottom} boxSize="14px" />
                  </IconButton>
                ) : null}
                {showSidePanel ? (
                  <IconButton
                    size={PANEL_HEADER_CONTROL_SIZE}
                    variant="ghost"
                    aria-label="Toggle side panel"
                    aria-pressed={!sidePanel.collapsed}
                    onClick={sidePanel.toggle}
                  >
                    <Icon as={PanelRight} boxSize="14px" />
                  </IconButton>
                ) : null}
              </Flex>
            </Header>
            <Box flex="1" minH="0" minW="0">
              <PanelCard title="main" description="resource · always on" bg="bg.panel" {...cardProps} />
            </Box>
            {showSecondaryPanel ? (
              <>
                <PrototypeResizeHandle
                  orientation="horizontal"
                  label="Resize secondary panel"
                  size={separatorSize}
                  hoverDelayMs={hoverDelayMs}
                  onResizeStart={secondary.startDrag}
                  onResize={secondary.drag}
                  onStep={secondary.step}
                  onToggle={secondary.toggle}
                />
                <SizedSlot height={secondary.size} collapsed={secondary.collapsed}>
                  <PanelCard title="Secondary Panel" description="resource · hideable" bg="bg.panel" {...cardProps} />
                </SizedSlot>
              </>
            ) : null}
          </Flex>
          {showSidePanel ? (
            <>
              <PrototypeResizeHandle
                orientation="vertical"
                label="Resize side panel"
                size={separatorSize}
                hoverDelayMs={hoverDelayMs}
                onResizeStart={sidePanel.startDrag}
                onResize={sidePanel.drag}
                onStep={sidePanel.step}
                onToggle={sidePanel.toggle}
              />
              <SizedSlot width={sidePanel.size} collapsed={sidePanel.collapsed}>
                <PanelCard title="Side Panel" description="project · chat" bg="bg.panel" {...cardProps} />
              </SizedSlot>
            </>
          ) : null}
        </Flex>
      </Flex>
      <StatusTray />
    </Flex>
  );
};
