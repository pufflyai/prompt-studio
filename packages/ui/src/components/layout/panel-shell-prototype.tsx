import { Box, Flex, Icon, IconButton, Text } from "@chakra-ui/react";
import { Bot, Files, GitBranch, MoreHorizontal } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Header } from "@/components/layout/header";
import { PANEL_HEADER_CONTROL_SIZE } from "@/components/layout/panel-header.constants";
import { PrototypeResizeHandle } from "@/components/layout/panel-shell-prototype.handle";

// Prototype of the panel chrome redesign, reviewed in Storybook before the real
// implementation. Resizable regions render as rounded cards with a gap between
// them. Fixed chrome (activity rail, header row, status tray) sits flat on the
// background with no borders.

export type PrototypeGap = "2xs" | "xs" | "sm";
export type PrototypeRadius = "xs" | "compact" | "sm" | "md";

export interface PanelShellPrototypeProps {
  gap: PrototypeGap;
  radius: PrototypeRadius;
  hoverDelayMs: number;
  showPanelBorders: boolean;
  showSecondaryPanel: boolean;
  showSidePanel: boolean;
}

const SIDENAV = { initial: 240, min: 160, max: 480 };
const SIDE_PANEL = { initial: 320, min: 240, max: 560 };
const SECONDARY = { initial: 200, min: 96, max: 480 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface PanelCardProps {
  title: string;
  description: string;
  bg: string;
  radius: PrototypeRadius;
  bordered: boolean;
}

const PanelCard = (props: PanelCardProps) => {
  const { title, description, bg, radius, bordered } = props;

  return (
    <Flex
      direction="column"
      h="full"
      w="full"
      minH="0"
      minW="0"
      bg={bg}
      borderRadius={radius}
      borderWidth={bordered ? "1px" : "0"}
      borderColor="border"
      overflow="hidden"
    >
      <Header variant="narrow" flexShrink={0}>
        <Text textStyle="label/S/medium" color="fg" truncate>
          {title}
        </Text>
        <IconButton
          size={PANEL_HEADER_CONTROL_SIZE}
          variant="ghost"
          aria-label="Panel actions"
          marginInlineStart="auto"
        >
          <Icon as={MoreHorizontal} boxSize="14px" />
        </IconButton>
      </Header>
      <Flex flex="1" minH="0" align="center" justify="center" px="sm">
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          {description}
        </Text>
      </Flex>
    </Flex>
  );
};

const ActivityRail = () => (
  <Flex as="nav" direction="column" align="center" flexShrink={0} w="3.5rem" py="xs" gap="2xs">
    <IconButton size="sm" variant="subtle" aria-label="Files">
      <Icon as={Files} boxSize="18px" />
    </IconButton>
    <IconButton size="sm" variant="ghost" aria-label="Source control">
      <Icon as={GitBranch} boxSize="18px" />
    </IconButton>
    <IconButton size="sm" variant="ghost" aria-label="Agents">
      <Icon as={Bot} boxSize="18px" />
    </IconButton>
  </Flex>
);

const StatusTray = () => (
  <Flex as="footer" align="center" flexShrink={0} h="2rem" px="sm" gap="sm">
    <Text fontSize="xs" color="fg.muted">
      main
    </Text>
    <Text fontSize="xs" color="fg.muted">
      3 files changed
    </Text>
    <Text fontSize="xs" color="fg.muted" marginInlineStart="auto">
      Claude Code · idle
    </Text>
  </Flex>
);

interface SizedSlotProps {
  width?: number;
  height?: number;
  children: ReactNode;
}

const SizedSlot = (props: SizedSlotProps) => {
  const { width, height, children } = props;

  return (
    <Box
      flexShrink={0}
      w={width === undefined ? "full" : `${width}px`}
      h={height === undefined ? "full" : `${height}px`}
      minW="0"
      minH="0"
    >
      {children}
    </Box>
  );
};

export const PanelShellPrototype = (props: PanelShellPrototypeProps) => {
  const { gap, radius, hoverDelayMs, showPanelBorders, showSecondaryPanel, showSidePanel } = props;
  const [sidenavWidth, setSidenavWidth] = useState(SIDENAV.initial);
  const [sidePanelWidth, setSidePanelWidth] = useState(SIDE_PANEL.initial);
  const [secondaryHeight, setSecondaryHeight] = useState(SECONDARY.initial);
  const dragStartRef = useRef(0);
  // The separator is the gap: it fills the space between two cards.
  const separatorSize = `var(--chakra-spacing-${gap})`;

  return (
    <Flex direction="column" h="full" w="full" minH="0" minW="0" bg="bg" color="fg" overflow="hidden">
      <Flex flex="1" minH="0" minW="0">
        <ActivityRail />
        <Flex flex="1" minH="0" minW="0" py={gap} pr={gap}>
          <SizedSlot width={sidenavWidth}>
            <PanelCard
              title="Sidenav"
              description="project · resizable"
              bg="bg.subtle"
              radius={radius}
              bordered={showPanelBorders}
            />
          </SizedSlot>
          <PrototypeResizeHandle
            orientation="vertical"
            label="Resize sidenav"
            size={separatorSize}
            hoverDelayMs={hoverDelayMs}
            onResizeStart={() => {
              dragStartRef.current = sidenavWidth;
            }}
            onResize={(delta) => setSidenavWidth(clamp(dragStartRef.current + delta, SIDENAV.min, SIDENAV.max))}
          />
          <Flex direction="column" flex="1" minH="0" minW="0">
            <Header variant="main" flexShrink={0} px="xs">
              <Text textStyle="label/M/medium" color="fg" truncate>
                workspace A
              </Text>
            </Header>
            <Box flex="1" minH="0" minW="0">
              <PanelCard
                title="main"
                description="resource · always on"
                bg="bg.panel"
                radius={radius}
                bordered={showPanelBorders}
              />
            </Box>
            {showSecondaryPanel ? (
              <>
                <PrototypeResizeHandle
                  orientation="horizontal"
                  label="Resize secondary panel"
                  size={separatorSize}
                  hoverDelayMs={hoverDelayMs}
                  onResizeStart={() => {
                    dragStartRef.current = secondaryHeight;
                  }}
                  onResize={(delta) =>
                    setSecondaryHeight(clamp(dragStartRef.current - delta, SECONDARY.min, SECONDARY.max))
                  }
                />
                <SizedSlot height={secondaryHeight}>
                  <PanelCard
                    title="Secondary Panel"
                    description="resource · hideable"
                    bg="bg.panel"
                    radius={radius}
                    bordered={showPanelBorders}
                  />
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
                onResizeStart={() => {
                  dragStartRef.current = sidePanelWidth;
                }}
                onResize={(delta) =>
                  setSidePanelWidth(clamp(dragStartRef.current - delta, SIDE_PANEL.min, SIDE_PANEL.max))
                }
              />
              <SizedSlot width={sidePanelWidth}>
                <PanelCard
                  title="Side Panel"
                  description="project · chat"
                  bg="bg.panel"
                  radius={radius}
                  bordered={showPanelBorders}
                />
              </SizedSlot>
            </>
          ) : null}
        </Flex>
      </Flex>
      <StatusTray />
    </Flex>
  );
};
