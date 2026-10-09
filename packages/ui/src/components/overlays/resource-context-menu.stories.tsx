import { Box, Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Eye } from "lucide-react";
import { useState } from "react";
import { expect, fireEvent, screen, userEvent, waitFor, within } from "storybook/test";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";

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

const meta: Meta<typeof ResourceContextMenu> = {
  title: "Components/Overlays/Resource Context Menu",
  component: ResourceContextMenu,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Right-click menu for resource and Sidenav actions. Menus taller than the space left in the viewport scroll inside the menu.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ResourceContextMenu>;

export const Default: Story = {
  render: () => <ResourceContextMenu actions={createActions(4)}>{menuTarget}</ResourceContextMenu>,
};

export const VisibilitySubmenu: Story = {
  render: () => <NestedVisibilityMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.contextMenu(canvas.getByText("Right-click here"));
    const unavailable = await screen.findByRole("menuitem", { name: "Unavailable options" });
    await expect(unavailable).toHaveAttribute("data-disabled");
    await userEvent.hover(unavailable);
    await expect(screen.queryByRole("menuitem", { name: "Unavailable child" })).toBeNull();
    const trigger = await screen.findByRole("menuitem", { name: "Hide/show items" });
    await userEvent.hover(trigger);
    const toggle = await screen.findByRole("menuitem", { name: "Notes", exact: true });
    await waitFor(() => {
      const bounds = toggle.closest('[role="menu"]')!.getBoundingClientRect();
      const anchor = trigger.getBoundingClientRect();
      expect(Math.abs(bounds.top - anchor.top)).toBeLessThanOrEqual(anchor.height);
    });
    await userEvent.click(toggle);
    await expect(canvas.getByText("Notes hidden")).toBeVisible();
    await userEvent.click(toggle);
    await expect(canvas.getByText("Notes shown")).toBeVisible();
    await userEvent.keyboard("{Escape}{ArrowRight}");
    await expect(toggle).toBeVisible();
    await userEvent.keyboard("{Escape}{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  },
};

export const InlineAction: Story = {
  render: () => <InlineActionMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.contextMenu(canvas.getByText("Right-click here"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Toggle visibility" }));
    await expect(canvas.getByText("Hidden")).toBeVisible();
    await expect(screen.getByRole("menu")).toBeVisible();
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename inline" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await expect(canvas.getByRole("textbox", { name: "Name" })).toHaveFocus();
  },
};

export const KeyboardAndTouch: Story = {
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
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByText("Session row");
    row.focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Open session" })).toBeVisible());
    await expect(screen.getByRole("menuitem", { name: "Unavailable action" })).toHaveAttribute("data-disabled");
    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await expect(row).toHaveFocus();
    await fireEvent.pointerDown(row, { pointerType: "touch", clientX: 40, clientY: 40 });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Open session" })).toBeVisible());
    await fireEvent.pointerUp(row, { pointerType: "touch" });
    await expect(screen.getAllByRole("menu")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
  },
};

export const LongMenuScrolls: Story = {
  render: () => (
    <ResourceContextMenu actions={createActions(60)} closeOnSelect={false}>
      {menuTarget}
    </ResourceContextMenu>
  ),
  play: async ({ canvasElement }) => {
    fireEvent.contextMenu(within(canvasElement).getByText("Right-click here"));
    const menu = await screen.findByRole("menu");
    await waitFor(() => expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight));
    await expect(screen.getByRole("menuitem", { name: "Sidenav entry 60" })).toBeInTheDocument();
  },
};
