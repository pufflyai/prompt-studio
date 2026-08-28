import { Box, Flex, Heading, HStack, Link, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Columns3,
  FileChartColumn,
  FlaskConical,
  GraduationCap,
  MessageCircle,
  Palette,
  SquareTerminal,
} from "lucide-react";

interface GalleryEntry {
  id: string;
  name: string;
  description: string;
  version?: string;
  icon: LucideIcon;
}

const DESKTOP_EXTENSIONS: GalleryEntry[] = [
  {
    id: "pstdio-planner",
    name: "Planner",
    description: "Turn projects into agent-ready tickets, boards, and automations.",
    version: "1.4.2",
    icon: Columns3,
  },
  {
    id: "pstdio-reports",
    name: "Reports",
    description: "Capture implementation, review, and validation handoffs.",
    version: "1.1.0",
    icon: FileChartColumn,
  },
  {
    id: "pstdio-skills",
    name: "Skills",
    description: "Package repeatable agent instructions for every project.",
    version: "1.0.3",
    icon: GraduationCap,
  },
  {
    id: "pstdio-base-themes",
    name: "Base themes",
    description: "Switch the entire workbench across curated color modes.",
    version: "2.0.1",
    icon: Palette,
  },
  {
    id: "pstdio-extension-lab",
    name: "Extension lab",
    description: "Build and preview new workbench extensions locally.",
    version: "0.9.4",
    icon: FlaskConical,
  },
  {
    id: "harness-open-code",
    name: "OpenCode harness",
    description: "Connect OpenCode models and sessions to your projects.",
    version: "1.2.0",
    icon: SquareTerminal,
  },
];

const MOBILE_EXTENSIONS: GalleryEntry[] = [
  { id: "pstdio-planner", name: "Planner", description: "Plan, assign, and track agent work.", icon: Columns3 },
  {
    id: "pstdio-reports",
    name: "Reports",
    description: "Generate implementation and review reports.",
    icon: FileChartColumn,
  },
  { id: "pstdio-slack", name: "Slack", description: "Bring project updates into team channels.", icon: MessageCircle },
  {
    id: "pstdio-build-monitor",
    name: "Build Monitor",
    description: "Watch builds and surface failing checks.",
    icon: Activity,
  },
];

const extensionCodeUrl = (id: string) => `https://github.com/pufflyai/prompt-studio/tree/main/extensions/${id}`;

const GalleryCard = (props: { entry: GalleryEntry; mobile?: boolean }) => {
  const { entry, mobile = false } = props;

  const content = (
    <>
      <Flex
        width={mobile ? "36px" : "44px"}
        height={mobile ? "36px" : "44px"}
        flexShrink="0"
        align="center"
        justify="center"
        bg="bg.hover"
        borderWidth={mobile ? "0" : "1px"}
        borderColor="border"
        rounded={mobile ? "6px" : "9px"}
      >
        <entry.icon size={mobile ? 17 : 22} />
      </Flex>
      <Stack gap="2px" flex="1" minWidth="0">
        <Text fontFamily="heading" fontWeight={mobile ? "medium" : "semibold"} fontSize="15px">
          {entry.name}
        </Text>
        <Text fontFamily="body" fontSize={mobile ? "12px" : "13px"} lineHeight="1.35" color="fg.muted">
          {entry.description}
        </Text>
      </Stack>
      {entry.version && (
        <Box px="8px" py="3px" bg="bg.hover" rounded="full">
          <Text fontFamily="mono" fontSize="9px" color="fg.muted">
            {entry.version}
          </Text>
        </Box>
      )}
    </>
  );

  const sharedProps = {
    minHeight: mobile ? "83px" : "85px",
    gap: "14px",
    px: mobile ? "14px" : "15px",
    py: "12px",
    bg: "bg.subtle",
    borderWidth: "1px",
    borderColor: "border",
    rounded: "8px",
  } as const;

  if (mobile) return <HStack {...sharedProps}>{content}</HStack>;

  return (
    <HStack asChild {...sharedProps} _hover={{ bg: "bg.hover", textDecoration: "none" }}>
      <Link href={extensionCodeUrl(entry.id)} target="_blank" rel="noopener">
        {content}
      </Link>
    </HStack>
  );
};

export const ExtensionGallery = () => (
  <>
    <Stack display={{ base: "flex", md: "none" }} width="100%" gap="0" px="16px" pt="20px" pb="92px">
      <Heading as="h1" fontFamily="heading" fontWeight="semibold" fontSize="26px" lineHeight="1.15">
        Extension gallery
      </Heading>
      <Text fontFamily="body" fontSize="13px" lineHeight="1.45" color="fg.muted" mt="10px">
        A sample of focused tools and workflows available for a workbench.
      </Text>
      <Stack gap="7px" mt="16px">
        {MOBILE_EXTENSIONS.map((entry) => (
          <GalleryCard key={entry.id} entry={entry} mobile />
        ))}
      </Stack>
    </Stack>
    <Stack display={{ base: "none", md: "flex" }} width="100%" gap="14px" pt="28px" pb="34px" px="32px">
      <Text fontFamily="mono" fontSize="10px" fontWeight="semibold" letterSpacing="1.1px" color="purple.300">
        EXTEND THE WORKBENCH
      </Text>
      <Heading as="h1" fontFamily="heading" fontWeight="semibold" fontSize="28px" letterSpacing="-0.5px">
        Extension gallery
      </Heading>
      <Text fontFamily="body" fontSize="13px" color="fg.muted" mt="-7px">
        Add tools, agent harnesses, themes, and workflows without leaving the workbench.
      </Text>
      <SimpleGrid columns={{ md: 2, xl: 3 }} gap="14px" mt="4px">
        {DESKTOP_EXTENSIONS.map((entry) => (
          <GalleryCard key={entry.id} entry={entry} />
        ))}
      </SimpleGrid>
    </Stack>
  </>
);
