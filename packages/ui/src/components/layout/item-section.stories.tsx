import { Box, Icon, Menu, Stack } from "@chakra-ui/react";
import { FileText, Folder, Settings, Star } from "lucide-react";
import type { ReactNode } from "react";

import { ItemSection } from "@/components/layout/item-section";
import { ListRow } from "@/components/list-row/list-row";

type StoryFn = () => ReactNode;

const meta = {
  title: "Components/Layout/Item Section",
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

interface SectionMenuItemProps {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

const SectionMenuItem = (props: SectionMenuItemProps) => {
  const { id, label, description, icon, disabled } = props;
  return (
    <Menu.Item value={id} asChild>
      <ListRow asChild variant="full-width" label={label} description={description} icon={icon} disabled={disabled} />
    </Menu.Item>
  );
};

export const Default = {
  render: () => (
    <ItemSection title="Files">
      <Menu.Root>
        <Stack gap="0" paddingLeft="xs" paddingY="xs">
          <SectionMenuItem id="overview" label="Project Overview" icon={<Icon as={FileText} boxSize="16px" />} />
          <SectionMenuItem id="assets" label="Assets" icon={<Icon as={Folder} boxSize="16px" />} />
          <SectionMenuItem id="settings" label="Settings" icon={<Icon as={Settings} boxSize="16px" />} />
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
            <SectionMenuItem id="dashboard" label="Main Dashboard" icon={<Icon as={Star} boxSize="16px" />} />
            <SectionMenuItem id="reports" label="Reports" icon={<Icon as={FileText} boxSize="16px" />} />
          </Stack>
        </Menu.Root>
      </ItemSection>
      <ItemSection title="Recent" defaultOpen={false}>
        <Menu.Root>
          <Stack gap="0" paddingLeft="xs" paddingY="xs">
            <SectionMenuItem id="alpha" label="Project Alpha" icon={<Icon as={Folder} boxSize="16px" />} />
            <SectionMenuItem id="beta" label="Project Beta" icon={<Icon as={Folder} boxSize="16px" />} />
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
          <SectionMenuItem id="john" label="John Doe" description="Admin" />
          <SectionMenuItem id="jane" label="Jane Smith" description="Editor" />
          <SectionMenuItem id="bob" label="Bob Wilson" description="Viewer" disabled />
        </Stack>
      </Menu.Root>
    </ItemSection>
  ),
};
