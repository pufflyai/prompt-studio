import { Box } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { workbenchBackgrounds, workbenchFocusBorder } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";
import type { useBottomPanelResize } from "./use-bottom-panel-resize";

interface WorkbenchMainBottomSectionProps {
  workbench: WorkbenchCore;
  hasMainBottomHeader: boolean;
  hasMainBottomContentTabs: boolean;
  bottomResize: ReturnType<typeof useBottomPanelResize>;
}

export const WorkbenchMainBottomSection = (props: WorkbenchMainBottomSectionProps) => {
  const { workbench, hasMainBottomHeader, hasMainBottomContentTabs, bottomResize } = props;

  return (
    <>
      <Box
        role="separator"
        aria-label="Resize main-bottom panel"
        aria-orientation="horizontal"
        aria-valuemin={bottomResize.minHeight}
        aria-valuemax={bottomResize.maxHeight}
        aria-valuenow={Math.round(bottomResize.height)}
        tabIndex={0}
        position="relative"
        zIndex="1"
        cursor="row-resize"
        touchAction="none"
        outline="none"
        onPointerDown={bottomResize.onPointerDown}
        onKeyDown={bottomResize.onKeyDown}
        _before={{
          content: '""',
          position: "absolute",
          insetInline: 0,
          top: "50%",
          h: "1px",
          bg: "border.muted",
          transform: "translateY(-50%)",
        }}
        _hover={{ _before: { bg: "border.emphasized" } }}
        _focusVisible={{ _before: { bg: workbenchFocusBorder, h: "2px" } }}
      />
      <WorkbenchFocusRegion
        workbench={workbench}
        area="panel"
        as="section"
        bg={workbenchBackgrounds.panel}
        minH="0"
        minW="0"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {hasMainBottomHeader || hasMainBottomContentTabs ? (
          <Header
            variant="main"
            bg={workbenchBackgrounds.panel}
            position="relative"
            flexShrink={0}
            gap="xs"
            overflow="hidden"
            overflowY="hidden"
          >
            <WorkbenchAreaTabs workbench={workbench} area="main-bottom" />
            {hasMainBottomHeader ? (
              <Box flex="1" h="full" minW="0" overflow="hidden">
                <WorkbenchArea
                  workbench={workbench}
                  area="main-bottom-header"
                  title="Main bottom header"
                  showHeader={false}
                />
              </Box>
            ) : null}
            <WorkbenchHeaderBorder workbench={workbench} area="main-bottom-header" />
          </Header>
        ) : null}
        <Box flex="1" minH="0" minW="0" overflow="hidden">
          <WorkbenchArea workbench={workbench} area="main-bottom" title="Main bottom" />
        </Box>
      </WorkbenchFocusRegion>
    </>
  );
};
