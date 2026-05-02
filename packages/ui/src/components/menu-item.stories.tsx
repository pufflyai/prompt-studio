import { Box, Button, Icon, Menu, Stack } from "@chakra-ui/react";
import { ChevronDown, ChevronRight, FileText, Folder, Settings, Star } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import type { ListRowItem } from "./list-row/list-row.types";
import { MenuItem } from "./menu-item";

type StoryFn = () => ReactNode;
type MenuItemStoryArgs = ComponentProps<typeof MenuItem>;

const icon = (as: ComponentProps<typeof Icon>["as"]) => <Icon as={as} boxSize="16px" color="fg.menu-item.default" />;

const baseItem: ListRowItem = {
  id: "reports",
  label: "Reports",
  description: "Financial and tax summaries",
  tooltip: "Open reports",
  icon: icon(FileText),
  endContent: icon(ChevronRight),
};

const meta = {
  title: "Components/Menu",
  component: MenuItem,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="sm" background="bg">
        <Story />
      </Box>
    ),
  ],
  args: { item: baseItem },
};

export default meta;

const renderMenuList = (children: ReactNode) => (
  <Menu.Root>
    <Stack
      width="20rem"
      gap="2px"
      padding="sm"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.muted"
      background="bg"
    >
      {children}
    </Stack>
  </Menu.Root>
);

const renderMenuItem = (args: MenuItemStoryArgs) => renderMenuList(<MenuItem {...args} />);

export const Default = {
  render: renderMenuItem,
};

export const Selected = {
  args: {
    isSelected: true,
    item: { ...baseItem, endContent: icon(Star) },
  },
  render: renderMenuItem,
};

export const NoIcon = {
  args: {
    item: { id: "activity", label: "Activity log", description: "Latest updates" },
  },
  render: renderMenuItem,
};

export const NoDescription = {
  args: {
    item: { id: "invoices", label: "Invoices", icon: icon(FileText) },
  },
  render: renderMenuItem,
};

export const Compact = {
  args: {
    variant: "compact",
  },
  render: renderMenuItem,
};

export const Disabled = {
  args: {
    item: { ...baseItem, description: "Requires admin access", disabled: true },
  },
  render: renderMenuItem,
};

export const MenuList = {
  render: () =>
    renderMenuList(
      <>
        <MenuItem item={{ id: "files", label: "Files", description: "Recent uploads", icon: icon(Folder) }} />
        <MenuItem
          item={{
            id: "reports",
            label: "Reports",
            description: "Financial and tax summaries",
            icon: icon(FileText),
            endContent: icon(ChevronRight),
          }}
        />
        <MenuItem item={{ id: "activity", label: "Activity log", description: "Latest updates" }} />
        <MenuItem isSelected item={{ id: "settings", label: "Settings", description: "Workspace preferences" }} />
        <MenuItem item={{ id: "locked", label: "Billing", description: "Requires admin access", disabled: true }} />
      </>,
    ),
};

export const DropdownMenu = {
  render: () => (
    <Menu.Root defaultOpen>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline">
          Actions
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px" bg="bg">
          <MenuItem
            item={{
              id: "sort",
              label: "Sort by",
              description: "Newest first",
              tooltip: "Change sort order",
              icon: icon(ChevronDown),
            }}
          />
          <MenuItem
            item={{ id: "duplicate", label: "Duplicate", description: "Create a copy", icon: icon(FileText) }}
          />
          <MenuItem
            item={{
              id: "move",
              label: "Move to folder",
              description: "Organize this item",
              icon: icon(Folder),
              endContent: icon(ChevronRight),
            }}
          />
          <Menu.Separator />
          <MenuItem item={{ id: "settings", label: "Settings", icon: icon(Settings) }} />
          <MenuItem item={{ id: "archive", label: "Archive", description: "Requires admin access", disabled: true }} />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  ),
};

export const WithGroupLabel = {
  render: () => (
    <Menu.Root defaultOpen>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline">
          Actions
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px" bg="bg">
          <Menu.ItemGroup>
            <Menu.ItemGroupLabel>Workspace</Menu.ItemGroupLabel>
            <MenuItem item={{ id: "files", label: "Files", description: "Recent uploads", icon: icon(Folder) }} />
            <MenuItem
              item={{
                id: "reports",
                label: "Reports",
                description: "Financial and tax summaries",
                icon: icon(FileText),
              }}
            />
          </Menu.ItemGroup>
          <Menu.Separator />
          <Menu.ItemGroup>
            <Menu.ItemGroupLabel>Admin</Menu.ItemGroupLabel>
            <MenuItem item={{ id: "settings", label: "Settings", icon: icon(Settings) }} />
            <MenuItem
              item={{ id: "archive", label: "Archive", description: "Requires admin access", disabled: true }}
            />
          </Menu.ItemGroup>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  ),
};
