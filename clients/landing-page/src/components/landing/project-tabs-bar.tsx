import { Box, Circle, HStack, Text } from "@chakra-ui/react";
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
  onSelectTab: (tab: ProjectTabId) => void;
}

export const ProjectTabsBar = (props: ProjectTabsBarProps) => {
  const { activeTab, onSelectTab } = props;

  return (
    <HStack
      height="44px"
      flexShrink="0"
      gap="8px"
      px="10px"
      bg="bg.subtle"
      borderBottomWidth="1px"
      borderColor="border"
      overflow="hidden"
    >
      <HStack className="group" width="52px" justify="flex-end" gap="8px" flexShrink="0">
        {MAC_CONTROLS.map((control) => (
          <Circle key={control.label} size="12px" bg={control.color} color="blackAlpha.700" aria-label={control.label}>
            <Box display="none" _groupHover={{ display: "flex" }}>
              <control.icon size={8} strokeWidth={3} />
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
              _hover={{ bg: "bg.hover", color: "fg" }}
              display={{ base: isActive ? "flex" : "none", md: "flex" }}
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
  );
};
