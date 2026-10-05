import { Box, Flex } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import { VIEW_META } from "../../content/landing-content";
import type { LandingDocument, LandingPage } from "../../content/landing-pages";
import { useLandingDocument } from "../../hooks/use-landing-document";
import { useLandingNavigation } from "../../hooks/use-landing-navigation";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { useWindowChrome } from "../../hooks/use-window-chrome";
import {
  landingPathForExample,
  landingPathForView,
  nextLandingView,
  previousLandingView,
  sectionForPage,
} from "../../services/landing-route";
import { ExamplesView } from "../sections/examples-view";
import { FeaturesView } from "../sections/features-view";
import { StartHereView } from "../sections/start-here-view";
import { WhatIsPromptStudioView } from "../sections/what-is-prompt-studio-view";
import { CommandPaletteModal } from "./command-palette-modal";
import { LandingPanels } from "./landing-panels";
import { PageNavigation } from "./page-navigation";
import { ProjectTabsBar } from "./project-tabs-bar";
import { ReadingContent } from "./reading-content";
import { ResourceSidebar } from "./resource-sidebar";
import { WorkbenchNav } from "./workbench-nav";
import { WorkbenchStatusBar } from "./workbench-status-bar";

type StudioPage = LandingPage & { view: "start" | "what-is-prompt-studio" | "examples" | "features" };

const isStudioPage = (page: LandingPage): page is StudioPage =>
  ["start", "what-is-prompt-studio", "examples", "features"].includes(page.view);

interface StudioContentProps {
  page: StudioPage;
  onNavigate: (path: string) => void;
  windowOffset?: { x: number; y: number };
}

const StudioContent = (props: StudioContentProps) => {
  const { page, onNavigate, windowOffset } = props;
  if (page.view === "start") return <StartHereView windowOffset={windowOffset} />;
  let content = <FeaturesView />;
  if (page.view === "examples")
    content = (
      <ExamplesView
        key={page.exampleId}
        exampleId={page.exampleId}
        onNavigate={(exampleId) => onNavigate(landingPathForExample(exampleId))}
      />
    );
  if (page.view === "what-is-prompt-studio") content = <WhatIsPromptStudioView />;
  return (
    <Box layerStyle="panel" bg="bg" width="full" minWidth="0" height="full" overflow="hidden">
      {content}
    </Box>
  );
};

const studioPageLinks = (page: StudioPage) => {
  const previous = previousLandingView(page.view);
  const next = nextLandingView(page.view);
  return {
    previous: previous ? { href: landingPathForView(previous), label: VIEW_META[previous].label } : undefined,
    next: { href: landingPathForView(next), label: VIEW_META[next].label },
  };
};

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
      <WorkbenchNav page={page} onOpenNavigation={() => setPaletteOpen(true)} />
      <Box as="main" css={styles.main} aria-busy={loading || undefined}>
        {isStudioPage(shownPage) ? (
          <LandingPanels page={shownPage} navigation={<PageNavigation {...studioPageLinks(shownPage)} />}>
            <StudioContent page={shownPage} onNavigate={navigate} windowOffset={windowed ? offset : undefined} />
          </LandingPanels>
        ) : (
          <ReadingContent page={shownPage} pages={pages} document={document} />
        )}
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
      <CommandPaletteModal
        open={paletteOpen}
        pages={pages}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
      />
    </Box>
  );
};
