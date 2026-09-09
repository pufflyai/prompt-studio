import { Box, Flex, useBreakpointValue } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { LandingView } from "../../content/landing-content";
import { privacyPage, termsPage } from "../../content/legal";
import { useLandingNavigation } from "../../hooks/use-landing-navigation";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { useWindowChrome } from "../../hooks/use-window-chrome";
import { docPageToMarkdown } from "../../services/doc-page-markdown";
import { START_HERE_INTRO, START_HERE_TITLE } from "../downloads/download-panel";
import { DocView } from "../sections/doc-view";
import { ExamplesView } from "../sections/examples-view";
import { FeaturesView } from "../sections/features-view";
import { StartHereView } from "../sections/start-here-view";
import { WhyPromptStudioView } from "../sections/why-prompt-studio-view";
import { CommandPaletteModal } from "./command-palette-modal";
import { LandingPanels } from "./landing-panels";
import { ProjectTabsBar } from "./project-tabs-bar";
import { ResourceSidebar } from "./resource-sidebar";
import { WorkbenchNav } from "./workbench-nav";
import { WorkbenchStatusBar } from "./workbench-status-bar";

const LEGAL_PAGES = { privacy: privacyPage, terms: termsPage };

interface LandingContentProps {
  view: LandingView;
  windowOffset?: { x: number; y: number };
}

const LandingContent = (props: LandingContentProps) => {
  const { view, windowOffset } = props;
  if (view === "start") return <StartHereView windowOffset={windowOffset} />;
  let page = <FeaturesView />;
  if (view === "examples") page = <ExamplesView />;
  if (view === "why-prompt-studio") page = <WhyPromptStudioView />;
  if (view === "privacy" || view === "terms") page = <DocView page={LEGAL_PAGES[view]} />;
  return (
    <Box layerStyle="panel" bg="bg" width="full" minWidth="0" height="full" overflow="hidden">
      {page}
    </Box>
  );
};

const markdownForView = (view: LandingView) => {
  if (view === "privacy" || view === "terms") return docPageToMarkdown(LEGAL_PAGES[view]);
  if (view === "start") return `# ${START_HERE_TITLE}\n\n${START_HERE_INTRO}\n`;
  return undefined;
};

interface WorkbenchLandingProps {
  initialPath: string;
}

export const WorkbenchLanding = (props: WorkbenchLandingProps) => {
  const { initialPath } = props;
  const { view, navigate, paletteOpen, setPaletteOpen } = useLandingNavigation(initialPath);
  const { windowed, offset, toggleWindowed, onTitleBarPointerDown } = useWindowChrome();
  const styles = useLandingStyles(windowed);
  const showSidebar = useBreakpointValue({ base: false, lg: true }) ?? false;

  const content = (
    <Flex direction="column" flex="1" minWidth="0">
      <WorkbenchNav
        activeView={view}
        resourceMarkdown={markdownForView(view)}
        onNavigate={navigate}
        onOpenNavigation={() => setPaletteOpen(true)}
      />
      <Box as="main" css={styles.main}>
        <LandingPanels>
          <LandingContent view={view} windowOffset={windowed ? offset : undefined} />
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
          {showSidebar ? (
            <ResizableSplitLayout
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
          ) : (
            content
          )}
        </Flex>
        <WorkbenchStatusBar onNavigate={navigate} />
      </Flex>
      <CommandPaletteModal open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} />
    </Box>
  );
};
