import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Eye } from "lucide-react";
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
    await waitFor(() => {
      const menu = screen.getByRole("menu").getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      expect(Math.abs(menu.top - bounds.bottom)).toBeLessThan(bounds.height);
    });
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
