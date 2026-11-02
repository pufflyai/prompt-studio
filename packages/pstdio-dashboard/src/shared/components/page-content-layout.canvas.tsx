import { Box, Stack, Text } from "@chakra-ui/react";
import { PageContentLayout } from "./page-content-layout";
export default {
  title: "Dashboard/Page content layout",
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
    <PageContentLayout
      header={
        <Stack padding="lg">
          <Text textStyle="label/S">Extensions / Example extension</Text>
          <Text textStyle="heading/M">Example extension</Text>
          <Text textStyle="label/XS">acme.example</Text>
        </Stack>
      }
    >
      <Content />
    </PageContentLayout>
  </Box>
);
