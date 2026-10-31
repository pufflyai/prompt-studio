import { Box, Icon, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Eye } from "lucide-react";
import { useState } from "react";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { getIconComponent } from "@/components/primitives/icon-options";

const createActions = (count: number): ResourceContextAction[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `entry-${index}`,
    label: `Sidenav entry ${index + 1}`,
    endContent: <Eye size={14} />,
    separatorBefore: index > 0 && index % 6 === 0,
    onClick: () => undefined,
  }));
// The menu passes its trigger props through `asChild`, so the target must be an element that forwards them.
const menuTarget = (
  <Box borderWidth="1px" borderColor="border" borderRadius="xs" p="md" w="15rem">
    <Text textStyle="label/S/regular">Right-click here</Text>
  </Box>
);
export const TicketActions: CanvasFrame<typeof ResourceContextMenu> = {
  id: "components-overlays-resource-context-menu--ticket-actions",
  args: {
    children: menuTarget,
    actions: [
      ["play", "Run attempt"],
      ["sparkles", "Refine ticket"],
      ["list-tree", "Break into sub-tickets"],
      ["archive", "Archive"],
      ["trash", "Delete"],
    ].map(([key, label]) => ({ key, label, icon: <Icon as={getIconComponent(key)} boxSize="4" /> })),
  },
};
const InlineActionMenu = () => {
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(true);
  return (
    <Stack>
      <ResourceContextMenu
        closeOnSelect={false}
        actions={[
          { key: "toggle", label: "Toggle visibility", onClick: () => setShown(!shown) },
          { key: "rename", label: "Rename inline", closeOnSelect: true, onClick: () => setEditing(true) },
        ]}
      >
        {menuTarget}
      </ResourceContextMenu>
      <Text>{shown ? "Shown" : "Hidden"}</Text>
      {editing ? <Input autoFocus size="xs" aria-label="Name" onBlur={() => setEditing(false)} /> : null}
    </Stack>
  );
};
const NestedVisibilityMenu = () => {
  const [shown, setShown] = useState(true);
  return (
    <Stack>
      <ResourceContextMenu
        closeOnSelect={false}
        actions={[
          {
            key: "visibility",
            label: "Hide/show items",
            items: [
              {
                key: "notes",
                label: "Notes",
                closeOnSelect: false,
                endContent: <Eye size={14} />,
                onClick: () => setShown(!shown),
              },
            ],
          },
          {
            key: "unavailable",
            label: "Unavailable options",
            isDisabled: true,
            items: [{ key: "hidden", label: "Unavailable child", onClick: () => undefined }],
          },
        ]}
      >
        {menuTarget}
      </ResourceContextMenu>
      <Text>{shown ? "Notes shown" : "Notes hidden"}</Text>
    </Stack>
  );
};
const LongVisibilityMenu = () => {
  const [selected, setSelected] = useState("Nothing selected");
  return (
    <Stack>
      <ResourceContextMenu
        closeOnSelect={false}
        actions={[
          {
            key: "visibility",
            label: "Hide/show items",
            items: createActions(60).map((action) => ({ ...action, onClick: () => setSelected(action.label) })),
          },
        ]}
      >
        {menuTarget}
      </ResourceContextMenu>
      <Text>{selected}</Text>
    </Stack>
  );
};
const meta: CanvasMeta<typeof ResourceContextMenu> = {
  title: "Components/Overlays/Resource Context Menu",
  component: ResourceContextMenu,
  description:
    "Right-click menu for resource and Sidenav actions. Menus taller than the space left in the viewport scroll inside the menu.",
};
export default meta;
type Story = CanvasFrame<typeof ResourceContextMenu>;
export const Default: Story = {
  id: "components-overlays-resource-context-menu--default",
  render: () => <ResourceContextMenu actions={createActions(4)}>{menuTarget}</ResourceContextMenu>,
};
export const SelectionAction: Story = {
  id: "components-overlays-resource-context-menu--selection-action",
  args: {
    children: menuTarget,
    actions: [{ key: "toggle", label: "Toggle visibility", onSelect: () => {} }],
  },
};
export const VisibilitySubmenu: Story = {
  id: "components-overlays-resource-context-menu--visibility-submenu",
  render: () => <NestedVisibilityMenu />,
};
export const InlineAction: Story = {
  id: "components-overlays-resource-context-menu--inline-action",
  render: () => <InlineActionMenu />,
};
export const KeyboardAndTouch: Story = {
  id: "components-overlays-resource-context-menu--keyboard-and-touch",
  render: () => (
    <ResourceContextMenu actions={[{ key: "customize", label: "Customize navigation", onClick: () => undefined }]}>
      <Box p="md">
        <ResourceContextMenu
          actions={[
            { key: "open", label: "Open session", onClick: () => undefined },
            { key: "disabled", label: "Unavailable action", isDisabled: true, onClick: () => undefined },
          ]}
        >
          <Box tabIndex={0} p="md">
            Session row
          </Box>
        </ResourceContextMenu>
      </Box>
    </ResourceContextMenu>
  ),
};
export const LongMenuScrolls: Story = {
  id: "components-overlays-resource-context-menu--long-menu-scrolls",
  render: () => (
    <ResourceContextMenu actions={createActions(60)} closeOnSelect={false}>
      {menuTarget}
    </ResourceContextMenu>
  ),
};
export const EscapeRespectsNewFocus: Story = {
  id: "components-overlays-resource-context-menu--escape-respects-new-focus",
  render: () => (
    <Stack>
      <ResourceContextMenu actions={createActions(1)}>
        <Box tabIndex={0} p="md">
          Context target
        </Box>
      </ResourceContextMenu>
      <Input aria-label="Next control" />
    </Stack>
  ),
};
export const LongSubmenuScrolls: Story = {
  id: "components-overlays-resource-context-menu--long-submenu-scrolls",
  render: () => <LongVisibilityMenu />,
};
export const ResourceAndSurfaceGroups: CanvasFrame<typeof meta> = {
  id: "components-overlays-resource-context-menu--resource-and-surface-groups",
  args: {
    children: menuTarget,
    actions: [
      { key: "rename", label: "Rename session", group: { id: "resource", label: "Session" } },
      { key: "archive", label: "Archive session", group: { id: "resource", label: "Session" } },
      { key: "new", label: "New session", group: { id: "quick", label: "Sessions" } },
      { key: "switch", label: "Switch session", group: { id: "sessions", label: "Sessions" } },
      { key: "all", label: "View all sessions", group: { id: "quick", label: "Sessions" } },
      { key: "pin", label: "Pin tab", group: { id: "tab", label: "Tab" } },
    ],
  },
};
