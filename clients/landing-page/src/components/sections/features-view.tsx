import { Box, Stack, Text } from "@chakra-ui/react";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { PageScroll } from "../workbench/page-scroll";
import { BuildingBlocks } from "./building-blocks";
import { WorkbenchServices } from "./workbench-services";

export const FeaturesView = () => {
  const styles = useStoryStyles();
  return (
    <PageScroll>
      <Box css={styles.page}>
        <WorkbenchServices />
        <Box as="section" css={styles.section} aria-labelledby="building-blocks-title">
          <Stack gap="sm">
            <Text id="building-blocks-title" as="h2" textStyle={{ base: "heading/S", md: "heading/M" }}>
              Building blocks
            </Text>
            <Text textStyle="paragraph/M/regular" color="fg.muted">
              The pieces your agent combines into a tool.
            </Text>
          </Stack>
          <BuildingBlocks />
        </Box>
      </Box>
    </PageScroll>
  );
};
