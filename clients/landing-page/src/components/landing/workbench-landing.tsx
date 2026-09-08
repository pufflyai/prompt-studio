import { Box, Flex, useBreakpointValue } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { CommandPaletteModal } from "./command-palette-modal";
import { privacyPage, termsPage } from "./content/legal";
import { docPageToMarkdown } from "./doc-page-markdown";
import { DocView } from "./doc-view";
import { FeaturesView } from "./features-view";
import type { LandingView } from "./landing-content";
import { landingPathForView, landingViewFromPath } from "./landing-route";
import { ProjectTabsBar } from "./project-tabs-bar";
import { ResourceSidebar } from "./resource-sidebar";
import { START_HERE_INTRO, START_HERE_TITLE, StartHereView } from "./start-here-view";
import { useLandingStyles } from "./use-landing-styles";
import { useWindowChrome } from "./use-window-chrome";
import { WhyPromptStudioView } from "./why-prompt-studio-view";
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
  if (view === "why-prompt-studio") page = <WhyPromptStudioView windowOffset={windowOffset} />;
  if (view === "privacy" || view === "terms") page = <DocView page={LEGAL_PAGES[view]} />;
  return (
    <Box layerStyle="panel" bg="bg" height="full" overflow="hidden">
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
  const [view, setView] = useState(() => landingViewFromPath(initialPath));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { windowed, offset, toggleWindowed, onTitleBarPointerDown } = useWindowChrome();
  const styles = useLandingStyles(windowed);
  const showSidebar = useBreakpointValue({ base: false, lg: true }) ?? false;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePopState = () => setView(landingViewFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (next: LandingView) => {
    const path = landingPathForView(next);
    setView(next);
    if (path !== window.location.pathname) window.history.pushState({}, "", path);
  };

  const content = (
    <Flex direction="column" flex="1" minWidth="0">
      <WorkbenchNav
        activeView={view}
        resourceMarkdown={markdownForView(view)}
        onNavigate={navigate}
        onOpenNavigation={() => setPaletteOpen(true)}
      />
      <Box as="main" css={styles.main}>
        <LandingContent view={view} windowOffset={windowed ? offset : undefined} />
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
