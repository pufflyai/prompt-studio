import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";

const SIDEBAR_ROWS = [
  { label: "Tickets", width: 72, active: true },
  { label: "Icon sets", width: 84, active: false },
  { label: "Shaders", width: 64, active: false },
  { label: "Formulas", width: 78, active: false },
  { label: "Notes", width: 56, active: false },
];

const TOOL_CARDS = [
  { title: "Coding agents", accent: "illustration.desktop", lines: [96, 62] },
  { title: "Icon set editor", accent: "illustration.editor", lines: [82, 70] },
  { title: "Shader editor", accent: "illustration.skill", lines: [74, 88] },
  { title: "Financial formulas", accent: "illustration.automation", lines: [90, 58] },
];

const Bar = (props: { width: number; tone?: "muted" | "strong" }) => {
  const { width, tone = "muted" } = props;
  return <Box width={`${width}px`} height="8px" borderRadius="2px" bg={tone === "strong" ? "fg.subtle" : "bg.muted"} />;
};

const TitleBar = () => (
  <HStack height="38px" px="12px" gap="12px" bg="bg.subtle" borderBottomWidth="1px" borderColor="border.subtle">
    <HStack gap="6px">
      <Box width="10px" height="10px" borderRadius="full" bg="windowControl.close" />
      <Box width="10px" height="10px" borderRadius="full" bg="windowControl.minimize" />
      <Box width="10px" height="10px" borderRadius="full" bg="windowControl.zoom" />
    </HStack>
    <HStack
      gap="8px"
      px="10px"
      py="5px"
      bg="bg"
      borderRadius="sm"
      borderWidth="1px"
      borderColor="border.subtle"
      color="fg.muted"
    >
      <Box width="8px" height="8px" borderRadius="2px" bg="illustration.desktop" />
      <Text textStyle="label/XS/medium">My workbench</Text>
    </HStack>
  </HStack>
);

const Sidebar = () => (
  <Stack
    width="158px"
    flexShrink={0}
    gap="4px"
    px="8px"
    py="12px"
    bg="bg.subtle"
    borderRightWidth="1px"
    borderColor="border.subtle"
  >
    <Box px="6px" pb="6px">
      <Text textStyle="label/2XS/medium" color="fg.subtle" letterSpacing="0.9px" textTransform="uppercase">
        Tools
      </Text>
    </Box>
    {SIDEBAR_ROWS.map((row) => (
      <HStack key={row.label} gap="8px" px="6px" py="7px" borderRadius="xs" bg={row.active ? "bg.active" : undefined}>
        <Box width="10px" height="10px" borderRadius="3px" bg={row.active ? "illustration.command" : "bg.muted"} />
        <Bar width={row.width} tone={row.active ? "strong" : "muted"} />
      </HStack>
    ))}
  </Stack>
);

const ToolCards = () => (
  <Box display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="12px">
    {TOOL_CARDS.map((card) => (
      <Stack
        key={card.title}
        gap="10px"
        p="14px"
        borderRadius="sm"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg.subtle"
      >
        <Box width="18px" height="18px" borderRadius="5px" bg={card.accent} />
        <Text textStyle="label/S/medium">{card.title}</Text>
        <Stack gap="6px">
          {card.lines.map((line) => (
            <Bar key={line} width={line} />
          ))}
        </Stack>
      </Stack>
    ))}
  </Box>
);

export const WorkbenchMock = () => (
  <Flex direction="column" layerStyle="panel" bg="bg" width="100%" height="100%">
    <TitleBar />
    <Flex flex="1" minHeight="0">
      <Sidebar />
      <Stack flex="1" minWidth="0" gap="16px" p="18px">
        <Stack gap="8px">
          <Bar width={132} tone="strong" />
          <Bar width={188} />
        </Stack>
        <ToolCards />
      </Stack>
    </Flex>
  </Flex>
);
