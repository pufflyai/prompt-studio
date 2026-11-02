import { Box, Button, HStack, IconButton, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Folder, ListTree, PanelBottom, PanelRight, Plus } from "lucide-react";
import { useState } from "react";
import { ResourceActionMenu, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { ScopedPopover as Popover } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import { WindowTabs } from "./window-tabs";
import { WindowTitleBar } from "./window-title-bar";

const PanelControls = () => {
  const [open, setOpen] = useState(true);
  return (
    <HStack gap="2xs" role="group" aria-label="Panel controls">
      <IconButton
        aria-label="Toggle Sidenav"
        aria-pressed={open}
        variant="ghost"
        size="xs"
        onClick={() => setOpen(!open)}
      >
        <ListTree />
      </IconButton>
      <IconButton aria-label="Toggle Bottom Panel" variant="ghost" size="xs">
        <PanelBottom />
      </IconButton>
      <IconButton aria-label="Toggle Side Panel" variant="ghost" size="xs">
        <PanelRight />
      </IconButton>
    </HStack>
  );
};
const NoPanelControls = () => null;
interface ExampleProps {
  platform?: string;
  tabCount?: number;
  emptyActions?: boolean;
}
const Example = (props: ExampleProps) => {
  const { platform = "darwin", tabCount = 2, emptyActions = false } = props;
  const [tabs, setTabs] = useState(() =>
    Array.from({ length: tabCount }, (_, index) => ({
      id: String(index),
      label: `Project ${index + 1}`,
      icon: <Folder />,
    })),
  );
  const [selectedId, setSelectedId] = useState<string | undefined>("0");
  return (
    <WindowTitleBar platform={platform} actions={emptyActions ? <NoPanelControls /> : <PanelControls />}>
      <WindowTabs
        tabs={tabs}
        selectedId={selectedId}
        aria-label="Project tabs"
        onSelect={setSelectedId}
        onClose={(id) => {
          const remaining = tabs.filter((tab) => tab.id !== id);
          setTabs(remaining);
          if (selectedId === id) setSelectedId(remaining[0]?.id);
        }}
      />
      <IconButton aria-label="Open project" variant="ghost" size="xs">
        <Plus />
      </IconButton>
    </WindowTitleBar>
  );
};
const MenuExample = () => {
  const actions = [{ key: "archive", label: "Archive project" }];
  return (
    <>
      <Example />
      <Stack p="md" align="start">
        <ResourceContextMenu actions={actions}>
          <Box p="md">Right-click project</Box>
        </ResourceContextMenu>
        <ResourceActionMenu actions={actions}>
          <Button>Project actions</Button>
        </ResourceActionMenu>
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button>Project details</Button>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content>
                <Popover.Body>Project details</Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      </Stack>
    </>
  );
};
const meta = {
  title: "Components/Navigation/Window Title Bar",
  component: WindowTitleBar,
  args: { platform: "darwin" },
  description:
    "Place project tabs and their open-project button in children. Use actions for trailing panel controls. The title bar reserves native control bounds and adds a subtle separator before Windows and Linux controls. Empty actions collapse. macOS full screen releases the leading control reservation. Open menus and popovers pause window dragging so title-bar clicks can dismiss them.",
  fullscreen: true,
} satisfies CanvasMeta<typeof WindowTitleBar>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const MacOS: Story = {
  id: "components-navigation-window-title-bar--mac-os",
  render: () => <Example />,
};
export const Windows: Story = {
  id: "components-navigation-window-title-bar--windows",
  args: { platform: "win32" },
  render: () => <Example platform="win32" />,
};
export const Ubuntu: Story = {
  id: "components-navigation-window-title-bar--ubuntu",
  args: { platform: "linux" },
  render: () => <Example platform="linux" />,
};
export const Overflow: Story = {
  id: "components-navigation-window-title-bar--overflow",
  args: { platform: "win32" },
  render: () => (
    <Box maxWidth="2xl">
      <Example platform="win32" tabCount={12} />
    </Box>
  ),
};
export const FullScreen: Story = {
  id: "components-navigation-window-title-bar--full-screen",
  render: () => (
    <Box data-window-full-screen="">
      <Example />
    </Box>
  ),
};
export const EmptyActions: Story = {
  id: "components-navigation-window-title-bar--empty-actions",
  args: { platform: "win32" },
  render: () => <Example platform="win32" emptyActions />,
};
export const DismissMenus: Story = {
  id: "components-navigation-window-title-bar--dismiss-menus",
  render: () => <MenuExample />,
};
export const DismissPopovers: Story = {
  id: "components-navigation-window-title-bar--dismiss-popovers",
  render: () => <MenuExample />,
};
export const WindowsDark: Story = {
  id: "components-navigation-window-title-bar--windows-dark",
  ...Windows,
};
export const EmbeddedNativeGeometry: Story = {
  id: "components-navigation-window-title-bar--embedded-native-geometry",
  render: () => (
    <Box css={{ "--pstdio-title-bar-area-x": "10%", "--pstdio-title-bar-area-width": "80%" }}>
      <Example platform="linux" />
    </Box>
  ),
};
