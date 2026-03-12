import { Box, Menu, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { FileText, Folder, Settings } from "lucide-react";
import { ItemSection } from "./item-section";
import { MenuItem } from "./menu-item";
import { PanelMenu } from "./panel-menu";

const meta: Meta<typeof PanelMenu> = {
  title: "Components/PanelMenu",
  component: PanelMenu,
  decorators: [
    (Story) => (
      <Box height="560px" bg="bg">
        <Story />
      </Box>
    ),
  ],
  args: {
    title: "Project",
  },
};

export default meta;

type Story = StoryObj<typeof PanelMenu>;

export const Default: Story = {};

export const WithSections: Story = {
  args: {
    title: "Resources",
    children: (
      <Stack gap="sm">
        <ItemSection title="Workspace">
          <Menu.Root>
            <Stack gap="0" paddingLeft="xs" paddingY="xs">
              <MenuItem primaryLabel="Overview" leftIcon={FileText} />
              <MenuItem primaryLabel="Files" leftIcon={Folder} />
            </Stack>
          </Menu.Root>
        </ItemSection>
        <ItemSection title="Settings">
          <Menu.Root>
            <Stack gap="0" paddingLeft="xs" paddingY="xs">
              <MenuItem primaryLabel="Preferences" leftIcon={Settings} />
            </Stack>
          </Menu.Root>
        </ItemSection>
      </Stack>
    ),
  },
};

export const Compact: Story = {
  args: {
    title: "Project",
    variant: "compact",
    children: (
      <Stack gap="2xs">
        <ItemSection title="Workspace">
          <Menu.Root>
            <Stack gap="0" paddingLeft="xs" paddingY="xs">
              <MenuItem primaryLabel="Overview" leftIcon={FileText} variant="compact" />
              <MenuItem primaryLabel="Files" leftIcon={Folder} variant="compact" />
            </Stack>
          </Menu.Root>
        </ItemSection>
        <ItemSection title="Settings">
          <Menu.Root>
            <Stack gap="0" paddingLeft="xs" paddingY="xs">
              <MenuItem primaryLabel="Preferences" leftIcon={Settings} variant="compact" />
            </Stack>
          </Menu.Root>
        </ItemSection>
      </Stack>
    ),
  },
};
