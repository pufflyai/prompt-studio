import { Box, chakra, HStack, Text } from "@chakra-ui/react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { PromptStudioIcon } from "../icons/prompt-studio-icon";

interface ProjectTabsBarProps {
  windowed: boolean;
  onNavigateHome: () => void;
  onToggleWindowed: () => void;
  onTitleBarPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onTitleBarDoubleClick: () => void;
}

export const ProjectTabsBar = (props: ProjectTabsBarProps) => {
  const { windowed, onNavigateHome, onToggleWindowed, onTitleBarPointerDown, onTitleBarDoubleClick } = props;

  const styles = useLandingStyles(windowed);
  const controls = [
    { id: "close", label: "Close", icon: X, disabled: windowed },
    { id: "minimize", label: "Minimize", icon: Minus, disabled: windowed },
    {
      id: "zoom",
      label: windowed ? "Expand window" : "Collapse window",
      icon: windowed ? Maximize2 : Minimize2,
      disabled: false,
    },
  ];

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
        <Box
          className="group"
          css={styles.windowControls}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {controls.map((control) => (
            <chakra.button
              key={control.id}
              type="button"
              css={styles.windowControl}
              data-control={control.id}
              disabled={control.disabled}
              aria-label={control.label}
              title={control.label}
              onClick={onToggleWindowed}
            >
              <control.icon strokeWidth={3} />
            </chakra.button>
          ))}
        </Box>
        <HStack
          as="button"
          css={styles.brandTab}
          onClick={onNavigateHome}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Box boxSize="icon-sm" flexShrink="0" aria-hidden="true">
            <PromptStudioIcon />
          </Box>
          <Text fontFamily="heading" fontWeight="medium" textStyle="label/S/medium" whiteSpace="nowrap">
            Prompt Studio
          </Text>
        </HStack>
      </Box>
    </>
  );
};
