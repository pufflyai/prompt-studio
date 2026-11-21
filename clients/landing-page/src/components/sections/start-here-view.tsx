import { Box } from "@chakra-ui/react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DownloadPanel } from "../downloads/download-panel";
import { HomeScene } from "../iso/iso-scenes";
import { PageScroll } from "../workbench/page-scroll";

export const StartHereView = () => {
  const styles = useLandingStyles();
  return (
    <Box css={styles.hero} as="section" aria-labelledby="download-panel-title">
      <PageScroll>
        <Box css={styles.heroLayout}>
          <DownloadPanel headingLevel="h1" />
          <Box css={styles.heroScene}>
            <HomeScene />
          </Box>
        </Box>
      </PageScroll>
    </Box>
  );
};
