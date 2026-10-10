import { Box } from "@chakra-ui/react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DownloadPanel } from "../downloads/download-panel";
import { AssemblyFrame } from "../shapes/assembly-frame";
import { ShapeField } from "../shapes/shape-field";
import { PageScroll } from "../workbench/page-scroll";

export const StartHereView = () => {
  const styles = useLandingStyles();
  return (
    <Box css={styles.hero} as="section" aria-labelledby="download-panel-title">
      <PageScroll>
        <Box css={styles.heroLayout} data-assembly-area="">
          <DownloadPanel headingLevel="h1" />
          <Box css={styles.cardSpace} aria-hidden="true">
            <AssemblyFrame />
          </Box>
          <ShapeField />
        </Box>
      </PageScroll>
    </Box>
  );
};
