import { Box } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { LandingPage } from "../../content/landing-pages";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DownloadPanel } from "../downloads/download-panel";
import { PageScroll } from "./page-scroll";

interface LandingPanelsProps {
  children: ReactNode;
  navigation: ReactNode;
  page: LandingPage;
}

export const LandingPanels = (props: LandingPanelsProps) => {
  const { children, navigation, page } = props;
  const styles = useLandingStyles();
  return (
    <PageScroll scope="panels" pageKey={page.path}>
      <ResizableSplitLayout
        layout={{ base: "stacked-reverse", lg: "split" }}
        resizableSide="left"
        defaultSizePx={480}
        minSizePx={360}
        contentMinSizePx={300}
        collapsible={false}
        resizeLabel="Resize download panel"
        resizablePanel={
          <Box css={styles.hero} as="section" aria-labelledby="download-panel-title">
            <Box flex="1" minHeight="0">
              <PageScroll>
                <DownloadPanel headingLevel={page.view === "start" ? "h1" : "h2"} />
              </PageScroll>
            </Box>
            {navigation}
          </Box>
        }
        contentPanel={children}
      />
    </PageScroll>
  );
};
