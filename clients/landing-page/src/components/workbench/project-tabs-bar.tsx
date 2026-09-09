import { Box, Circle, HStack, Text } from "@chakra-ui/react";
import { Minus, Plus, X } from "lucide-react";
import { PROJECT_TAB } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { PromptStudioIcon } from "../icons/prompt-studio-icon";

// the macOS traffic-light chrome colors are OS constants, not design-system tokens
const MAC_CONTROLS = [
  { label: "Close", color: "#FF5F57", icon: X },
  { label: "Minimize", color: "#FEBC2E", icon: Minus },
  { label: "Zoom", color: "#28C840", icon: Plus },
];

interface ProjectTabsBarProps {
  windowed: boolean;
  onNavigateHome: () => void;
  /**
   * Every window control unmaximises rather than doing what it says. A landing page
   * that can be closed into a blank desktop is a dead end, so red and yellow lead
   * somewhere recoverable too; green toggles back.
   */
  onToggleWindowed: () => void;
  onTitleBarPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onTitleBarDoubleClick: () => void;
}

export const ProjectTabsBar = (props: ProjectTabsBarProps) => {
  const { windowed, onNavigateHome, onToggleWindowed, onTitleBarPointerDown, onTitleBarDoubleClick } = props;

  const styles = useLandingStyles(windowed);

  return (
    <>
      <Box as="button" aria-label="Go to Prompt Studio home" css={styles.mobileTitlebar} onClick={onNavigateHome}>
        <Box width="5" height="5" flexShrink="0">
          <PromptStudioIcon />
        </Box>
        <Text fontFamily="heading" fontWeight="medium" textStyle="label/M/medium" lineHeight="1.2">
          Prompt Studio
        </Text>
      </Box>
      <Box css={styles.titlebar} onPointerDown={onTitleBarPointerDown} onDoubleClick={onTitleBarDoubleClick}>
        <Box className="group" css={styles.windowControls}>
          {MAC_CONTROLS.map((control) => (
            <Circle
              key={control.label}
              as="button"
              size="icon-2xs"
              bg={control.color}
              color="blackAlpha.700"
              aria-label={control.label}
              // Stop the title-bar drag from claiming the pointer, otherwise the click
              // never lands and green cannot restore the window.
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onToggleWindowed();
              }}
            >
              <Box display="none" _groupHover={{ display: "flex" }}>
                <control.icon size={7} strokeWidth={3} />
              </Box>
            </Circle>
          ))}
        </Box>
        <HStack as="button" css={styles.brandTab} onClick={onNavigateHome}>
          <PROJECT_TAB.icon size={14} />
          <Text fontFamily="heading" fontWeight="medium" textStyle="label/S/medium" whiteSpace="nowrap">
            {PROJECT_TAB.label}
          </Text>
        </HStack>
      </Box>
    </>
  );
};
