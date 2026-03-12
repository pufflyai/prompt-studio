import { Box, Menu, Stack } from "@chakra-ui/react";
import { FileText, Folder, Settings, Star } from "lucide-react";
import type { ReactNode } from "react";

import { ItemSection } from "./item-section";
import { MenuItem } from "./menu-item";

type StoryFn = () => ReactNode;

const meta = {
  title: "Components/ItemSection",
  component: ItemSection,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="lg" background="bg" maxWidth="300px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

export const Default = {
  render: () => (
    <ItemSection title="Files">
      <Menu.Root>
        <Stack gap="0" paddingLeft="xs" paddingY="xs">
          <MenuItem primaryLabel="Project Overview" leftIcon={FileText} />
          <MenuItem primaryLabel="Assets" leftIcon={Folder} />
          <MenuItem primaryLabel="Settings" leftIcon={Settings} />
        </Stack>
      </Menu.Root>
    </ItemSection>
  ),
};

export const MultipleSections = {
  render: () => (
    <Stack gap="sm">
      <ItemSection title="Favorites">
        <Menu.Root>
          <Stack gap="0" paddingLeft="xs" paddingY="xs">
            <MenuItem primaryLabel="Main Dashboard" leftIcon={Star} />
            <MenuItem primaryLabel="Reports" leftIcon={FileText} />
          </Stack>
        </Menu.Root>
      </ItemSection>
      <ItemSection title="Recent" defaultOpen={false}>
        <Menu.Root>
          <Stack gap="0" paddingLeft="xs" paddingY="xs">
            <MenuItem primaryLabel="Project Alpha" leftIcon={Folder} />
            <MenuItem primaryLabel="Project Beta" leftIcon={Folder} />
          </Stack>
        </Menu.Root>
      </ItemSection>
    </Stack>
  ),
};

export const WithSecondaryLabels = {
  render: () => (
    <ItemSection title="Members">
      <Menu.Root>
        <Stack gap="0" paddingLeft="xs" paddingY="xs">
          <MenuItem primaryLabel="John Doe" secondaryLabel="Admin" />
          <MenuItem primaryLabel="Jane Smith" secondaryLabel="Editor" />
          <MenuItem primaryLabel="Bob Wilson" secondaryLabel="Viewer" isDisabled />
        </Stack>
      </Menu.Root>
    </ItemSection>
  ),
};
