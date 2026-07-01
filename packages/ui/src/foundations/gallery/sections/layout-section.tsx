import { Badge, Button, Icon, Stack, Text } from "@chakra-ui/react";
import { FileText, Folder, Home, Settings, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { ItemSection } from "@/components/layout/item-section";
import { ListRow } from "@/components/list-row/list-row";
import { Breadcrumb } from "@/components/primitives/breadcrumb";
import { GalleryCard, GallerySection } from "../gallery-frame";

export const LayoutSection = () => {
  return (
    <GallerySection title="Layout & navigation" description="Headers, breadcrumbs, and collapsible sections.">
      <GalleryCard title="Header" names={["Header"]}>
        <Header variant="main" background="bg.muted">
          <Text textStyle="label/M/medium">Header title</Text>
          <Stack direction="row" gap="xs" marginInlineStart="auto">
            <Button size="sm" variant="ghost">
              Action
            </Button>
          </Stack>
        </Header>
      </GalleryCard>

      <GalleryCard title="Breadcrumb" names={["Breadcrumb"]}>
        <Breadcrumb
          items={[
            {
              title: (
                <>
                  <Icon as={Home} boxSize="14px" />
                  Home
                </>
              ),
              url: "/",
            },
            {
              title: (
                <>
                  <Icon as={Folder} boxSize="14px" />
                  Projects
                </>
              ),
              url: "/projects",
            },
            {
              title: (
                <>
                  <Icon as={FileText} boxSize="14px" />
                  Current project
                </>
              ),
            },
          ]}
          separator="/"
          separatorGap="xs"
        />
      </GalleryCard>

      <GalleryCard title="Item section" names={["ItemSection"]}>
        <ItemSection title="Settings" defaultOpen>
          <Stack gap="0" paddingLeft="xs" paddingY="xs">
            <Text textStyle="paragraph/S/regular" padding="2xs">
              Collapsible section content
            </Text>
          </Stack>
        </ItemSection>
      </GalleryCard>

      <GalleryCard title="Rows" names={["ListRow"]}>
        <Stack gap="2xs" width="100%">
          <ListRow
            id="overview-row"
            label="Overview"
            description="Project summary and recent activity"
            icon={<FileText size={14} />}
            endContent={<Badge colorPalette="blue">Open</Badge>}
          />
          <ListRow id="settings-row" label="Settings" icon={<Settings size={14} />} isSelected />
          <ListRow id="disabled-row" label="Locked resource" description="Managed by workspace policy" disabled />
          <ListRow id="delete-row" label="Delete project" icon={<Trash2 size={14} />} tone="danger" />
        </Stack>
      </GalleryCard>
    </GallerySection>
  );
};
