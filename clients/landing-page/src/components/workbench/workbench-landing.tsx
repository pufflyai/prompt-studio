import { Box, Flex } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { LandingView } from "../../content/landing-content";
import { privacyPage, termsPage } from "../../content/legal";
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
  view: LandingView;
  windowOffset?: { x: number; y: number };
}

const LandingContent = (props: LandingContentProps) => {
  const { view, windowOffset } = props;
  if (view === "start") return <StartHereView windowOffset={windowOffset} />;
  let page = <FeaturesView />;
  if (view === "examples") page = <ExamplesView />;
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
  const { view, navigate, paletteOpen, setPaletteOpen } = useLandingNavigation(initialPath);
  const { windowed, offset, toggleWindowed, onTitleBarPointerDown } = useWindowChrome();
  const styles = useLandingStyles(windowed);

  const content = (
    <Flex direction="column" flex="1" minWidth="0">
      <WorkbenchNav activeView={view} onOpenNavigation={() => setPaletteOpen(true)} />
      <Box as="main" css={styles.main}>
        <LandingPanels navigation={<PageNavigation view={view} onNavigate={navigate} />}>
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
