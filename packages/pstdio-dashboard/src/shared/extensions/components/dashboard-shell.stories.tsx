import { Badge, Box, Button, Flex, HStack, IconButton, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { Header, ListRow } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Bot,
  CircleHelp,
  FlaskConical,
  GitBranch,
  KanbanSquare,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

interface WebviewPlaceholderProps {
  slotId: string;
  title: string;
  contributor: string;
  entry: string;
  icon: ReactNode;
  height?: string;
}

const WebviewPlaceholder = (props: WebviewPlaceholderProps) => {
  const { slotId, title, contributor, entry, icon, height } = props;

  return (
    <Stack
      gap="0"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.emphasis"
      borderRadius="md"
      bg="bg.subtle"
      overflow="hidden"
      height={height}
      minH="0"
    >
      <HStack
        px="sm"
        py="2xs"
        borderBottomWidth="1px"
        borderColor="border.muted"
        bg="bg"
        justify="space-between"
        gap="xs"
      >
        <HStack gap="xs" minW="0">
          <Text textStyle="label/S/medium" truncate>
            {title}
          </Text>
          <Badge size="xs" variant="outline">
            {contributor}
          </Badge>
        </HStack>
        <Text textStyle="paragraph/XS/regular" color="fg.muted" fontFamily="mono">
          {slotId}
        </Text>
      </HStack>
      <Flex flex="1" minH="0" align="center" justify="center" direction="column" gap="2xs" p="md">
        {icon}
        <Text textStyle="paragraph/XS/regular" color="fg.muted" fontFamily="mono">
          iframe → {entry}
        </Text>
      </Flex>
    </Stack>
  );
};

const SidebarNavItem = (props: {
  id: string;
  label: string;
  icon: ReactNode;
  selected?: boolean;
  contributor?: string;
}) => (
  <ListRow
    variant="compact"
    id={props.id}
    label={props.label}
    icon={props.icon}
    isSelected={props.selected}
    endContent={
      props.contributor ? (
        <Badge size="xs" variant="outline">
          {props.contributor}
        </Badge>
      ) : undefined
    }
  />
);

const SidebarMock = () => (
  <Flex
    as="aside"
    direction="column"
    width="240px"
    minWidth="240px"
    borderRightWidth="1px"
    borderRightColor="border.muted"
    bg="bg"
    h="100%"
  >
    <HStack px="sm" py="xs" justify="space-between" borderBottomWidth="1px" borderColor="border.muted">
      <HStack gap="xs">
        <Box w="6" h="6" borderRadius="sm" bg="bg.emphasis" />
        <Text textStyle="label/M/medium">Acme</Text>
      </HStack>
    </HStack>

    <Stack flex="1" gap="md" p="xs" overflow="auto">
      <Stack gap="0">
        <SidebarNavItem id="search" label="Search" icon={<Search size={14} />} />
        <SidebarNavItem id="tickets" label="Tickets" icon={<KanbanSquare size={14} />} selected />
      </Stack>

      <Stack gap="2xs">
        <Text textStyle="label/XS/medium" color="fg.muted" px="2xs" fontFamily="mono">
          project.sidebarNav
        </Text>
        <Stack gap="0">
          <SidebarNavItem id="lab" label="Lab" icon={<FlaskConical size={14} />} contributor="extension-lab" />
          <SidebarNavItem
            id="repo-health"
            label="Repo health"
            icon={<GitBranch size={14} />}
            contributor="repo-health"
          />
          <SidebarNavItem id="changelog" label="Changelog" icon={<Workflow size={14} />} contributor="repo-health" />
        </Stack>
      </Stack>
    </Stack>

    <Stack gap="0" borderTopWidth="1px" borderColor="border.muted" p="xs">
      <SidebarNavItem id="help" label="Help" icon={<CircleHelp size={14} />} />
      <SidebarNavItem id="settings" label="Project settings" icon={<SettingsIcon size={14} />} />
    </Stack>
  </Flex>
);

const SlotChip = (props: { slotId: string }) => (
  <Text textStyle="paragraph/XS/regular" color="fg.muted" fontFamily="mono" flexShrink={0}>
    {props.slotId}
  </Text>
);

const HeaderMock = (props: { title: string }) => (
  <Header variant="main" gap="sm" width="100%" borderBottomWidth="1px" borderColor="border.muted">
    <Text textStyle="label/M/medium" flexShrink={0}>
      {props.title}
    </Text>
    <SlotChip slotId="project.headerPrimary" />
    <HStack gap="xs">
      <Button size="xs" variant="solid">
        Lab: Say hello
      </Button>
      <Button size="xs" variant="outline">
        Generate report
      </Button>
    </HStack>
    <Box flex="1" />
    <SlotChip slotId="project.headerOverflow" />
    <IconButton size="xs" variant="ghost" aria-label="Header overflow">
      <MoreHorizontal size={14} />
    </IconButton>
  </Header>
);

const TicketRowMock = (props: { shorthand: string; title: string; status: string }) => (
  <HStack
    px="sm"
    py="xs"
    borderBottomWidth="1px"
    borderColor="border.muted"
    gap="sm"
    bg="bg"
    _hover={{ bg: "bg.muted" }}
  >
    <Text textStyle="label/S/medium" color="fg.muted" minW="64px" fontFamily="mono">
      {props.shorthand}
    </Text>
    <Text textStyle="paragraph/S/regular" flex="1" truncate>
      {props.title}
    </Text>
    <Badge size="sm" variant="outline">
      {props.status}
    </Badge>
  </HStack>
);

const sampleTickets = [
  { shorthand: "PS-201", title: "Add command palette quick actions", status: "in progress" },
  { shorthand: "PS-198", title: "Theme dashboard surfaces", status: "review" },
  { shorthand: "PS-187", title: "Extension settings panels v1", status: "in progress" },
  { shorthand: "PS-174", title: "Cap session selector dropdown", status: "done" },
  { shorthand: "PS-159", title: "Pre-warm bun install cache in CI", status: "done" },
  { shorthand: "PS-142", title: "Validate compiled bun extension toolchain", status: "done" },
];

const TicketsContentMock = () => (
  <Stack flex="1" minH="0" gap="0">
    <HStack px="sm" py="xs" borderBottomWidth="1px" borderColor="border.muted" gap="sm">
      <Text textStyle="label/M/medium">All tickets</Text>
      <Badge size="sm" variant="outline">
        {sampleTickets.length}
      </Badge>
      <Box flex="1" />
      <Button size="xs" variant="outline">
        New ticket
      </Button>
    </HStack>
    <Box flex="1" minH="0" overflow="auto">
      {sampleTickets.map((ticket) => (
        <TicketRowMock key={ticket.shorthand} {...ticket} />
      ))}
    </Box>
  </Stack>
);

const SidebarViewSlotMock = () => (
  <Stack
    width="320px"
    minWidth="320px"
    borderLeftWidth="1px"
    borderLeftColor="border.muted"
    bg="bg.muted"
    p="sm"
    gap="sm"
    overflow="auto"
  >
    <HStack justify="space-between">
      <Text textStyle="label/M/medium">Extension views</Text>
      <SlotChip slotId="project.sidebar" />
    </HStack>
    <WebviewPlaceholder
      slotId="project.sidebar"
      title="Lab counter"
      contributor="extension-lab"
      entry="counter.html"
      icon={<Sparkles size={20} />}
      height="180px"
    />
    <WebviewPlaceholder
      slotId="project.sidebar"
      title="Repo health"
      contributor="repo-health"
      entry="health.html"
      icon={<GitBranch size={20} />}
      height="220px"
    />
  </Stack>
);

const ShellFrame = (props: { children: ReactNode }) => (
  <Flex h="100vh" w="100vw" bg="bg">
    <SidebarMock />
    <Flex flex="1" minW={0} direction="column">
      {props.children}
    </Flex>
  </Flex>
);

interface CommandEntry {
  id: string;
  label: string;
  icon: ReactNode;
}

const CommandPaletteEntry = (props: CommandEntry & { selected?: boolean }) => (
  <ListRow variant="compact" id={props.id} label={props.label} icon={props.icon} isSelected={props.selected} />
);

const CommandPaletteGroupHeader = (props: { label: string }) => (
  <Text textStyle="label/XS/medium" color="fg.muted" px="sm" pt="xs" pb="2xs">
    {props.label}
  </Text>
);

const CommandPaletteMock = () => (
  <Flex
    position="absolute"
    inset="0"
    align="flex-start"
    justify="center"
    pt="10vh"
    bg="blackAlpha.500"
    backdropFilter="auto"
    backdropBlur="4px"
  >
    <Stack
      w="44rem"
      maxW="92vw"
      bg="bg"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.muted"
      boxShadow="lg"
      gap="0"
      overflow="hidden"
    >
      <Box borderBottomWidth="1px" borderColor="border.muted">
        <InputGroup startElement={<Terminal size={16} />}>
          <Input
            value=">"
            placeholder="Run a command…"
            borderWidth="0"
            borderRadius="0"
            h="3rem"
            readOnly
            _focus={{ boxShadow: "none" }}
            _focusVisible={{ boxShadow: "none" }}
          />
        </InputGroup>
      </Box>
      <Stack gap="0" maxH="24rem" overflow="auto" pb="xs">
        <CommandPaletteEntry id="create-ticket" label="Create ticket" icon={<Plus size={14} />} />
        <CommandPaletteEntry id="project-settings" label="Open project settings" icon={<SettingsIcon size={14} />} />
        <CommandPaletteEntry id="shortcuts" label="Show keyboard shortcuts" icon={<CircleHelp size={14} />} />
        <CommandPaletteGroupHeader label="Extension Lab" />
        <CommandPaletteEntry id="lab.say-hello" label="Say hello" icon={<Sparkles size={14} />} selected />
        <CommandPaletteEntry id="lab.counter.bump" label="Bump lab counter" icon={<FlaskConical size={14} />} />
        <CommandPaletteEntry id="lab.counter.reset" label="Reset lab counter" icon={<Sparkles size={14} />} />
        <CommandPaletteGroupHeader label="Repo Health" />
        <CommandPaletteEntry id="repo-health.scan" label="Run repo health scan" icon={<GitBranch size={14} />} />
        <CommandPaletteEntry id="repo-health.changelog" label="Generate changelog" icon={<Workflow size={14} />} />
      </Stack>
    </Stack>
  </Flex>
);

const meta: Meta = {
  title: "Extensions/Dashboard Shell",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

export const ProjectShell: Story = {
  render: () => (
    <ShellFrame>
      <HeaderMock title="Tickets" />
      <Flex flex="1" minH="0">
        <TicketsContentMock />
        <SidebarViewSlotMock />
      </Flex>
    </ShellFrame>
  ),
};

export const CommandPalette: Story = {
  render: () => (
    <Box position="relative" h="100vh" w="100vw">
      <ShellFrame>
        <HeaderMock title="Tickets" />
        <Flex flex="1" minH="0">
          <TicketsContentMock />
          <SidebarViewSlotMock />
        </Flex>
      </ShellFrame>
      <CommandPaletteMock />
    </Box>
  ),
};

export const ExtensionRoute: Story = {
  render: () => (
    <ShellFrame>
      <HeaderMock title="Repo health" />
      <Box flex="1" minH="0" p="md">
        <WebviewPlaceholder
          slotId="routes[].webview"
          title="/projects/:projectId/extensions/repo-health"
          contributor="repo-health"
          entry="health-page.html"
          icon={<PanelLeft size={28} />}
          height="100%"
        />
      </Box>
    </ShellFrame>
  ),
};

export const Settings: Story = {
  render: () => (
    <ShellFrame>
      <HeaderMock title="Project settings" />
      <Flex flex="1" minH="0">
        <Stack
          width="240px"
          minWidth="240px"
          borderRightWidth="1px"
          borderRightColor="border.muted"
          bg="bg"
          p="xs"
          gap="2xs"
        >
          <SidebarNavItem id="agents" label="Agents" icon={<Bot size={14} />} />
          <SidebarNavItem id="repos" label="Repositories" icon={<GitBranch size={14} />} />
          <Text textStyle="label/XS/medium" color="fg.muted" px="2xs" pt="sm" fontFamily="mono">
            project.settingsPanels
          </Text>
          <Stack gap="0">
            <SidebarNavItem
              id="lab-settings"
              label="Lab settings"
              icon={<FlaskConical size={14} />}
              contributor="extension-lab"
              selected
            />
            <SidebarNavItem
              id="audit"
              label="Audit log"
              icon={<SettingsIcon size={14} />}
              contributor="extension-lab"
            />
            <SidebarNavItem
              id="health-settings"
              label="Repo health"
              icon={<GitBranch size={14} />}
              contributor="repo-health"
            />
          </Stack>
        </Stack>
        <Box flex="1" minH="0" p="md">
          <WebviewPlaceholder
            slotId="project.settingsPanels.webview"
            title="Lab settings"
            contributor="extension-lab"
            entry="lab-settings.html"
            icon={<FlaskConical size={28} />}
            height="100%"
          />
        </Box>
      </Flex>
    </ShellFrame>
  ),
};
