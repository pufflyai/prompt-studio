import { Box, Flex, Heading, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, FileCode2, GraduationCap, LayoutGrid, SquareTerminal, Webhook } from "lucide-react";

interface ExtensionCapability {
  name: string;
  description: string;
  badge: string;
  icon: LucideIcon;
}

const EXTENSION_CAPABILITIES: ExtensionCapability[] = [
  {
    name: "Commands",
    description: "Add pst commands that people and agents can run.",
    badge: "CLI",
    icon: SquareTerminal,
  },
  {
    name: "Pages",
    description: "Add project pages inside the workbench.",
    badge: "UI",
    icon: LayoutGrid,
  },
  {
    name: "Editors",
    description: "Build native editors for project resources.",
    badge: "NATIVE",
    icon: FileCode2,
  },
  {
    name: "Skills",
    description: "Package instructions an agent can install and follow.",
    badge: "AGENT",
    icon: GraduationCap,
  },
  {
    name: "Hooks",
    description: "React to project, workspace, and session events.",
    badge: "EVENTS",
    icon: Webhook,
  },
  {
    name: "Automations",
    description: "Schedule extension work without leaving the project.",
    badge: "SCHEDULED",
    icon: CalendarClock,
  },
];

const CapabilityCard = (props: { capability: ExtensionCapability }) => {
  const { capability } = props;

  return (
    <HStack
      minHeight={{ base: "77px", md: "94px" }}
      gap="14px"
      px="14px"
      py="12px"
      align="center"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border"
      rounded="8px"
    >
      <Flex
        width={{ base: "36px", md: "42px" }}
        height={{ base: "36px", md: "42px" }}
        flexShrink="0"
        align="center"
        justify="center"
        bg="bg.hover"
        rounded="6px"
      >
        <capability.icon size={18} />
      </Flex>
      <Stack gap="3px" flex="1" minWidth="0">
        <HStack justify="space-between" gap="8px">
          <Text fontFamily="heading" fontWeight="medium" fontSize="15px">
            {capability.name}
          </Text>
          <Box px="6px" py="2px" borderWidth="1px" borderColor="border" rounded="3px">
            <Text fontFamily="mono" fontSize="8px" color="fg.subtle">
              {capability.badge}
            </Text>
          </Box>
        </HStack>
        <Text fontFamily="body" fontSize="12px" lineHeight="1.4" color="fg.muted">
          {capability.description}
        </Text>
      </Stack>
    </HStack>
  );
};

export const ExtensionGallery = () => (
  <Box height="100%" overflowY="auto">
    <Stack width="100%" maxWidth="820px" mx="auto" gap="0" px={{ base: "16px", md: "32px" }} py="20px">
      <Heading
        as="h1"
        fontFamily="heading"
        fontWeight="semibold"
        fontSize={{ base: "26px", md: "30px" }}
        lineHeight="1.15"
      >
        Building Extensions
      </Heading>
      <Text fontFamily="body" fontSize="13px" lineHeight="1.5" color="fg.muted" mt="10px" maxWidth="620px">
        Agents can extend Prompt Studio with project commands and workbench tools.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="8px" mt="18px">
        {EXTENSION_CAPABILITIES.map((capability) => (
          <CapabilityCard key={capability.name} capability={capability} />
        ))}
      </SimpleGrid>
    </Stack>
  </Box>
);
