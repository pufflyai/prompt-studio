import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Header } from "@/components/header";
import { ItemSection } from "@/components/item-section";
import { ResizableSplitLayout } from "@/components/resizable-split-layout";
import { GalleryCard, GallerySection } from "../gallery-frame";

export const LayoutSection = () => {
  return (
    <GallerySection title="Layout & navigation" description="Headers, breadcrumbs, sections, and split layouts.">
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
          items={[{ title: "Home", url: "/" }, { title: "Projects", url: "/projects" }, { title: "Current project" }]}
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

      <GalleryCard title="Split layout" names={["ResizableSplitLayout"]}>
        <Box height="220px">
          <ResizableSplitLayout
            height="full"
            width="full"
            resizableSide="left"
            defaultSizePx={140}
            minSizePx={100}
            maxSizePx={240}
            contentMinSizePx={140}
            showResizeSeparator
            resizablePanel={
              <Box background="bg.muted" padding="md">
                <Text textStyle="label/S/regular">Left panel</Text>
              </Box>
            }
            contentPanel={
              <Box background="bg" padding="md">
                <Text textStyle="label/S/regular">Content area</Text>
              </Box>
            }
          />
        </Box>
      </GalleryCard>
    </GallerySection>
  );
};
