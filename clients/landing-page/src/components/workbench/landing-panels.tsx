import { Box } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DownloadPanel } from "../downloads/download-panel";
import { PageScroll } from "./page-scroll";

export const LandingPanels = (props: { children: ReactNode }) => {
  const { children } = props;
  const styles = useLandingStyles();
  return (
    <PageScroll scope="panels">
      <ResizableSplitLayout
        layout={{ base: "stacked", lg: "split" }}
        resizableSide="left"
        defaultSizePx={480}
        minSizePx={360}
        contentMinSizePx={300}
        collapsible={false}
        resizeLabel="Resize download panel"
        resizablePanel={
          <Box css={styles.hero}>
            <PageScroll>
              <DownloadPanel />
            </PageScroll>
          </Box>
        }
        contentPanel={children}
      />
    </PageScroll>
  );
};
