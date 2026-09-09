import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { PageScroll } from "../workbench/page-scroll";
import { WorkbenchServices } from "./workbench-services";

export const FeaturesView = (props: { footer: ReactNode }) => {
  const { footer } = props;
  const styles = useStoryStyles();
  return (
    <PageScroll>
      <Box css={styles.page}>
        <WorkbenchServices />
        {footer}
      </Box>
    </PageScroll>
  );
};
