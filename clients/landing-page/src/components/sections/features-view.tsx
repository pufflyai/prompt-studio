import { Box } from "@chakra-ui/react";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { PageScroll } from "../workbench/page-scroll";
import { WorkbenchServices } from "./workbench-services";

export const FeaturesView = () => {
  const styles = useStoryStyles();
  return (
    <PageScroll>
      <Box css={styles.page}>
        <WorkbenchServices />
      </Box>
    </PageScroll>
  );
};
