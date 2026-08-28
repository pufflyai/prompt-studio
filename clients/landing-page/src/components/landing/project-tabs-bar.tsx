import { Box, Circle, HStack, Stack, Text } from "@chakra-ui/react";
import { Minus, Plus, X } from "lucide-react";
import { PROJECT_TABS, type ProjectTabId } from "./landing-content";

// the macOS traffic-light chrome colors are OS constants, not design-system tokens
const MAC_CONTROLS = [
  { label: "Close", color: "#FF5F57", icon: X },
  { label: "Minimize", color: "#FEBC2E", icon: Minus },
  { label: "Zoom", color: "#28C840", icon: Plus },
];

interface ProjectTabsBarProps {
  activeTab: ProjectTabId;
  branchLabel: string;
  onNavigateHome: () => void;
  onSelectTab: (tab: ProjectTabId) => void;
}

export const ProjectTabsBar = (props: ProjectTabsBarProps) => {
  const { activeTab, branchLabel, onNavigateHome, onSelectTab } = props;

  return (
    <>
      <Stack
        as="button"
        aria-label="Go to Prompt Studio home"
        height="52px"
        flexShrink="0"
        gap="1px"
        px="8px"
        justify="center"
        bg="bg.subtle"
        borderBottomWidth="1px"
        borderColor="border"
        display={{ base: "flex", md: "none" }}
        textAlign="left"
        onClick={onNavigateHome}
      >
        <Text fontFamily="heading" fontWeight="medium" fontSize="13px" lineHeight="1.2">
          Prompt Studio
        </Text>
        <Text fontFamily="mono" fontSize="8px" letterSpacing="0.8px" color="fg.subtle" lineHeight="1.2">
          {branchLabel}
        </Text>
      </Stack>
      <HStack
        height="44px"
        flexShrink="0"
        gap="8px"
        px="10px"
        bg="bg.subtle"
        borderBottomWidth="1px"
        borderColor="border"
        overflow="hidden"
        display={{ base: "none", md: "flex" }}
      >
        <HStack className="group" width="44px" justify="flex-end" gap="8px" flexShrink="0">
          {MAC_CONTROLS.map((control) => (
            <Circle
              key={control.label}
              size="10px"
              bg={control.color}
              color="blackAlpha.700"
              aria-label={control.label}
            >
              <Box display="none" _groupHover={{ display: "flex" }}>
                <control.icon size={7} strokeWidth={3} />
              </Box>
            </Circle>
          ))}
        </HStack>
        <HStack gap="4px" overflow="hidden">
          {PROJECT_TABS.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <HStack
                key={tab.label}
                as="button"
                cursor="pointer"
                height="28px"
                px="10px"
                gap="7px"
                rounded="4px"
                flexShrink="0"
                bg={isActive ? "bg.hover" : "transparent"}
                color={isActive ? "fg" : "fg.subtle"}
                borderWidth="1px"
                borderColor={isActive ? "border" : "transparent"}
                _hover={{ bg: "bg.hover", color: "fg" }}
                onClick={() => onSelectTab(tab.id)}
              >
                <tab.icon size={14} />
                <Text fontFamily="heading" fontWeight="medium" fontSize="12px" whiteSpace="nowrap">
                  {tab.label}
                </Text>
              </HStack>
            );
          })}
        </HStack>
      </HStack>
    </>
  );
};
