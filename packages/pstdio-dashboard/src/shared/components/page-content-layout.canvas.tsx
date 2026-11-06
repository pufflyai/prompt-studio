import { Box, Stack, Tabs, Text } from "@chakra-ui/react";
import { PageContentLayout } from "./page-content-layout";
export default {
  title: "Product/Workbench/Page content layout",
  description: "Headers stay outside the scrolling body; nested pages use the workbench parent breadcrumb.",
};
const Content = () =>
  Array.from({ length: 30 }, (_, index) => (
    <Text key={index} padding="lg">
      Extension content {index + 1}
    </Text>
  ));
export const FixedHeader = () => (
  <Box h="96">
    <PageContentLayout
      header={
        <Text padding="lg" textStyle="heading/M">
          Extensions
        </Text>
      }
    >
      <Content />
    </PageContentLayout>
  </Box>
);
export const NestedExtension = () => (
  <Box h="96">
    <Tabs.Root defaultValue="contributions" size="sm" tray h="full" minH="0">
      <PageContentLayout
        header={
          <Stack gap="md">
            <Stack padding="lg">
              <Text textStyle="label/S">Extensions / Example extension</Text>
              <Text textStyle="heading/M">Example extension</Text>
              <Text textStyle="label/XS">acme.example</Text>
            </Stack>
            <Tabs.List>
              <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
              <Tabs.Trigger value="contributions">Contributions</Tabs.Trigger>
            </Tabs.List>
          </Stack>
        }
      >
        <Tabs.Content value="settings">
          <Text padding="lg">Extension settings</Text>
        </Tabs.Content>
        <Tabs.Content value="contributions">
          <Content />
        </Tabs.Content>
      </PageContentLayout>
    </Tabs.Root>
  </Box>
);
