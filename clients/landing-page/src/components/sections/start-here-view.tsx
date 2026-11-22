import { Box, chakra, Icon } from "@chakra-ui/react";
import { ArrowDown } from "lucide-react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DownloadPanel } from "../downloads/download-panel";
import { HomeScene } from "../iso/iso-scenes";

/** The first screen of the Studio scroll: download copy, the Home scene, and a pointer to what follows. */
export const StartHereView = () => {
  const styles = useLandingStyles();
  return (
    <Box css={styles.heroLayout} as="section" aria-labelledby="download-panel-title" data-studio-section="start">
      <DownloadPanel headingLevel="h1" />
      <Box css={styles.heroScene}>
        <HomeScene />
      </Box>
      <chakra.a href="/what-is-prompt-studio/" css={styles.scrollHint}>
        What is an agentic workbench?
        <Icon as={ArrowDown} boxSize="icon-md" />
      </chakra.a>
    </Box>
  );
};
