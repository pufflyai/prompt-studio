import { Box, Flex, Icon, IconButton, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Bot, GitBranch, MoreHorizontal, PanelLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { PANEL_HEADER_CONTROL_SIZE } from "@/components/layout/panel-header.constants";
import { ResizableSplitLayout } from "@/components/layout/resizable-split-layout";

interface PanelCardProps {
  title: string;
  description: string;
  bg?: string;
}

const PanelCard = (props: PanelCardProps) => {
  const { title, description, bg = "bg.panel" } = props;

  return (
    <Flex direction="column" h="full" w="full" minH="0" minW="0" bg={bg} layerStyle="panel" overflow="hidden">
      <Header variant="narrow" flexShrink={0}>
        <Text textStyle="label/S/medium" truncate>
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

const meta = {
  title: "Components/Layout/Resizable Split Layout",
  component: ResizableSplitLayout,
  parameters: { layout: "fullscreen" },
  args: {
    resizablePanel: (
      <PanelCard title="Sidenav" description="Drag the grip. Double-click or press Home to collapse." bg="bg.subtle" />
    ),
    contentPanel: <PanelCard title="Main" description="Hover a separator for a moment to see the bar." />,
    defaultSizePx: 240,
    minSizePx: 160,
    maxSizePx: 480,
    contentMinSizePx: 320,
    resizeLabel: "Resize sidenav",
    p: "panel-gap",
  },
  decorators: [
    (Story: () => ReactNode) => (
      <Box h="100vh" w="100vw" bg="bg" color="fg">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof ResizableSplitLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LeftPanel: Story = {};

export const BottomPanel: Story = {
  args: {
    resizableSide: "bottom",
    resizablePanel: <PanelCard title="Secondary Panel" description="resource · hideable" />,
    contentPanel: <PanelCard title="Main" description="resource · always on" />,
    defaultSizePx: 200,
    minSizePx: 96,
    contentMinSizePx: 200,
    resizeLabel: "Resize secondary panel",
  },
};

export const NotCollapsible: Story = {
  args: { collapsible: false },
};

export const ResponsivePanels: Story = {
  args: { layout: { base: "stacked", lg: "split" }, collapsible: false },
  parameters: {
    docs: {
      description: { story: "Stack panels below the large breakpoint. CSS selects the layout before hydration." },
    },
  },
};

export const ContentFirstOnMobile: Story = {
  args: { layout: { base: "stacked-reverse", lg: "split" }, collapsible: false },
};

export const ResponsiveNavigation: Story = {
  args: { layout: { base: "content", lg: "split" }, collapsible: false },
  parameters: {
    docs: {
      description: { story: "Hide the resizable navigation panel on small screens while keeping content mounted." },
    },
  },
};

const ActivityRail = () => (
  <Flex as="nav" direction="column" align="center" flexShrink={0} w="3.5rem" py="xs" gap="2xs">
    <IconButton size="sm" variant="subtle" aria-label="Files">
      <Icon as={PanelLeft} boxSize="18px" />
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

// The workbench shell: flat activity rail, header row and status tray around
// rounded panel cards separated by grip handles.
const PanelShell = () => (
  <Flex direction="column" h="full" w="full" minH="0" minW="0">
    <Flex flex="1" minH="0" minW="0">
      <ActivityRail />
      <Box flex="1" minH="0" minW="0" py="panel-gap" pr="panel-gap">
        <ResizableSplitLayout
          resizableSide="right"
          defaultSizePx={320}
          minSizePx={240}
          maxSizePx={560}
          contentMinSizePx={480}
          resizeLabel="Resize side panel"
          resizablePanel={<PanelCard title="Side Panel" description="project · chat" />}
          contentPanel={
            <ResizableSplitLayout
              defaultSizePx={240}
              minSizePx={160}
              maxSizePx={480}
              contentMinSizePx={320}
              resizeLabel="Resize sidenav"
              resizablePanel={<PanelCard title="Sidenav" description="project · resizable" bg="bg.subtle" />}
              contentPanel={
                <Flex direction="column" h="full" w="full" minH="0" minW="0">
                  <Header variant="main" flexShrink={0} px="xs">
                    <Text textStyle="label/M/medium" truncate>
                      workspace A
                    </Text>
                  </Header>
                  <ResizableSplitLayout
                    flex="1"
                    minH="0"
                    resizableSide="bottom"
                    defaultSizePx={200}
                    minSizePx={96}
                    maxSizePx={480}
                    contentMinSizePx={200}
                    resizeLabel="Resize secondary panel"
                    resizablePanel={<PanelCard title="Secondary Panel" description="resource · hideable" />}
                    contentPanel={<PanelCard title="main" description="resource · always on" />}
                  />
                </Flex>
              }
            />
          }
        />
      </Box>
    </Flex>
    <StatusTray />
  </Flex>
);

export const WorkbenchShell: Story = {
  render: () => <PanelShell />,
};

export const LineSeparator: Story = {
  args: {
    separator: "line",
    p: "0",
    resizablePanel: <PanelCard title="File list" description="Inner split: a 1px line instead of a grip." />,
    contentPanel: <PanelCard title="Diff" description="Hover the line to see the bar." />,
  },
};
