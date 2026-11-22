import { Box, Flex } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import { Suspense } from "react";
import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { useLandingDocument } from "../../hooks/use-landing-document";
import { useLandingNavigation } from "../../hooks/use-landing-navigation";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { useWindowChrome } from "../../hooks/use-window-chrome";
import { CommandMenu, ReadingPage } from "../../services/landing-modules";
import { sectionForPage } from "../../services/landing-route";
import { type StudioPage, StudioScroll } from "../sections/studio-scroll";
import { ProjectTabsBar } from "./project-tabs-bar";
import { ResourceSidebar } from "./resource-sidebar";
import { WorkbenchStatusBar } from "./workbench-status-bar";

const isStudioPage = (page: LandingPage): page is StudioPage =>
  ["start", "what-is-prompt-studio", "examples", "features"].includes(page.view);

interface WorkbenchLandingProps {
  initialPath: string;
  pages: LandingPage[];
  initialDocument: LandingDocument | undefined;
}

export const WorkbenchLanding = (props: WorkbenchLandingProps) => {
  const { initialPath, pages, initialDocument } = props;
  const { page, navigate, sectionPath, paletteOpen, setPaletteOpen } = useLandingNavigation(initialPath, pages);
  const { shownPage, document, loading } = useLandingDocument(page, initialDocument);
  const { windowed, offset, toggleWindowed, onTitleBarPointerDown } = useWindowChrome();
  const styles = useLandingStyles(windowed);

  const content = (
    <Flex direction="column" flex="1" minWidth="0">
      <Box as="main" css={styles.main} aria-busy={loading || undefined}>
        <Suspense fallback={null}>
          {isStudioPage(shownPage) ? (
            <StudioScroll page={shownPage} onNavigate={navigate} />
          ) : (
            <ReadingPage.Component page={shownPage} pages={pages} document={document} />
          )}
        </Suspense>
      </Box>
    </Flex>
  );

  return (
    <Box css={styles.root}>
      <Flex css={styles.window} style={{ transform: windowed ? `translate(${offset.x}px, ${offset.y}px)` : undefined }}>
        <ProjectTabsBar
          windowed={windowed}
          selected={sectionForPage(page)}
          sectionPath={sectionPath}
          onToggleWindowed={toggleWindowed}
          onTitleBarPointerDown={onTitleBarPointerDown}
          onTitleBarDoubleClick={toggleWindowed}
          actionMenuOpen={paletteOpen}
          onOpenActionMenu={() => setPaletteOpen(true)}
        />
        <Flex css={styles.body}>
          <ResizableSplitLayout
            layout={{ base: "content", lg: "split" }}
            width="full"
            height="full"
            defaultSizePx={220}
            minSizePx={180}
            maxSizePx={320}
            contentMinSizePx={600}
            collapsible={false}
            resizeLabel="Resize navigation"
            resizablePanel={<ResourceSidebar page={page} pages={pages} onNavigate={navigate} />}
            contentPanel={content}
          />
        </Flex>
        <WorkbenchStatusBar />
      </Flex>
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandMenu.Component open pages={pages} onClose={() => setPaletteOpen(false)} onNavigate={navigate} />
        </Suspense>
      )}
    </Box>
  );
};
