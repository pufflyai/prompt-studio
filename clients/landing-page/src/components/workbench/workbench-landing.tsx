import { Box, Flex } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { LandingPage } from "../../content/landing-pages";
import { privacyPage, termsPage } from "../../content/legal";
import type { ToolExampleId } from "../../content/tool-examples-content";
import { useLandingNavigation } from "../../hooks/use-landing-navigation";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { useWindowChrome } from "../../hooks/use-window-chrome";
import { DocView } from "../sections/doc-view";
import { ExamplesView } from "../sections/examples-view";
import { FeaturesView } from "../sections/features-view";
import { StartHereView } from "../sections/start-here-view";
import { WhatIsPromptStudioView } from "../sections/what-is-prompt-studio-view";
import { CommandPaletteModal } from "./command-palette-modal";
import { LandingPanels } from "./landing-panels";
import { PageNavigation } from "./page-navigation";
import { ProjectTabsBar } from "./project-tabs-bar";
import { ResourceSidebar } from "./resource-sidebar";
import { WorkbenchNav } from "./workbench-nav";
import { WorkbenchStatusBar } from "./workbench-status-bar";

const LEGAL_PAGES = { privacy: privacyPage, terms: termsPage };

interface LandingContentProps {
  page: LandingPage;
  onNavigateExample: (exampleId: ToolExampleId) => void;
  windowOffset?: { x: number; y: number };
}

const LandingContent = (props: LandingContentProps) => {
  const { page: activePage, onNavigateExample, windowOffset } = props;
  const { view, exampleId } = activePage;
  if (view === "start") return <StartHereView windowOffset={windowOffset} />;
  let page = <FeaturesView />;
  if (view === "examples" && exampleId)
    page = <ExamplesView key={exampleId} exampleId={exampleId} onNavigate={onNavigateExample} />;
  if (view === "what-is-prompt-studio") page = <WhatIsPromptStudioView />;
  if (view === "privacy" || view === "terms") page = <DocView page={LEGAL_PAGES[view]} />;
  return (
    <Box layerStyle="panel" bg="bg" width="full" minWidth="0" height="full" overflow="hidden">
      {page}
    </Box>
  );
};

interface WorkbenchLandingProps {
  initialPath: string;
}

export const WorkbenchLanding = (props: WorkbenchLandingProps) => {
  const { initialPath } = props;
  const { page, navigate, navigateExample, paletteOpen, setPaletteOpen } = useLandingNavigation(initialPath);
  const { view } = page;
  const { windowed, offset, toggleWindowed, onTitleBarPointerDown } = useWindowChrome();
  const styles = useLandingStyles(windowed);

  const content = (
    <Flex direction="column" flex="1" minWidth="0">
      <WorkbenchNav activeView={view} onOpenNavigation={() => setPaletteOpen(true)} />
      <Box as="main" css={styles.main}>
        <LandingPanels page={page} navigation={<PageNavigation view={view} onNavigate={navigate} />}>
          <LandingContent
            page={page}
            onNavigateExample={navigateExample}
            windowOffset={windowed ? offset : undefined}
          />
        </LandingPanels>
      </Box>
    </Flex>
  );

  return (
    <Box css={styles.root}>
      <Flex css={styles.window} style={{ transform: windowed ? `translate(${offset.x}px, ${offset.y}px)` : undefined }}>
        <ProjectTabsBar
          windowed={windowed}
          onNavigateHome={() => navigate("start")}
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
            resizablePanel={<ResourceSidebar activeView={view} onNavigate={navigate} />}
            contentPanel={content}
          />
        </Flex>
        <WorkbenchStatusBar onNavigate={navigate} />
      </Flex>
      <CommandPaletteModal open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} />
    </Box>
  );
};
