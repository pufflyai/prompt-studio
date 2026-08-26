import { Box, Flex, IconButton } from "@chakra-ui/react";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { AgenticKanbanView } from "./agentic-kanban-view";
import { BlogView } from "./blog-view";
import { ChangelogModal } from "./changelog-modal";
import { CommandPaletteModal } from "./command-palette-modal";
import { BLOG_POSTS, VISIBLE_BLOG_POSTS } from "./content/blog";
import { cliAgentsPage } from "./content/cli-agents";
import {
  cliConfigurationPage,
  cliExtensionsPage,
  cliOverviewPage,
  cliPlannerPage,
  cliProjectsPage,
  cliWorkspacesPage,
} from "./content/cli-reference";
import { cliSessionsPage } from "./content/cli-sessions";
import { conceptsPage } from "./content/docs";
import { extensionsPage } from "./content/extensions";
import {
  createExtensionGuide,
  createProposalGuide,
  createSubTicketsGuide,
  createTicketGuide,
  gettingStartedGuide,
  implementTicketGuide,
  refineTicketGuide,
} from "./content/guides";
import { privacyPage, termsPage } from "./content/legal";
import {
  sdkAssetsPage,
  sdkClientPage,
  sdkCommandsPage,
  sdkHooksPage,
  sdkOverviewPage,
  sdkViewsPage,
} from "./content/sdk-reference";
import { whyPromptStudioPage } from "./content/why-prompt-studio";
import { docPageToMarkdown } from "./doc-page-markdown";
import { type DocPage, DocView } from "./doc-view";
import { ExtensionGallery } from "./extension-gallery";
import type { LandingView, ProjectTabId } from "./landing-content";
import { LANDING_DOCUMENT_PAGE, LandingDocument } from "./landing-document";
import { type LandingLocation, landingLocationFromPath, landingPathForLocation } from "./landing-route";
import { ProjectTabsBar } from "./project-tabs-bar";
import { QuickstartView } from "./quickstart-view";
import { ResourceSidebar } from "./resource-sidebar";
import { WhyPromptStudioView } from "./why-prompt-studio-view";
import { WorkbenchNav } from "./workbench-nav";
import { WorkbenchStatusBar } from "./workbench-status-bar";

const DOC_PAGES: Partial<Record<LandingView, DocPage>> = {
  gallery: extensionsPage,
  "why-prompt-studio": whyPromptStudioPage,
  concepts: conceptsPage,
  "guide-getting-started": gettingStartedGuide,
  "guide-create-ticket": createTicketGuide,
  "guide-implement-ticket": implementTicketGuide,
  "guide-create-proposal": createProposalGuide,
  "guide-create-sub-tickets": createSubTicketsGuide,
  "guide-refine-ticket": refineTicketGuide,
  "guide-create-extension": createExtensionGuide,
  "cli-reference": cliOverviewPage,
  "cli-projects": cliProjectsPage,
  "cli-workspaces": cliWorkspacesPage,
  "cli-agents": cliAgentsPage,
  "cli-sessions": cliSessionsPage,
  "cli-extensions": cliExtensionsPage,
  "cli-planner": cliPlannerPage,
  "cli-configuration": cliConfigurationPage,
  "sdk-reference": sdkOverviewPage,
  "sdk-commands": sdkCommandsPage,
  "sdk-views": sdkViewsPage,
  "sdk-hooks": sdkHooksPage,
  "sdk-client": sdkClientPage,
  "sdk-assets": sdkAssetsPage,
  privacy: privacyPage,
  terms: termsPage,
};

interface WorkbenchLandingProps {
  initialPath: string;
}

const resolveResourceTitle = (activeView: LandingView, docPage: DocPage | undefined, blogPostId?: string) => {
  if (activeView === "blog") return (BLOG_POSTS.find((post) => post.id === blogPostId) ?? VISIBLE_BLOG_POSTS[0]).title;
  return docPage?.title;
};

const resolveResourceMarkdown = (activeView: LandingView, docPage: DocPage | undefined, blogPostId?: string) => {
  if (activeView === "start") return docPageToMarkdown(LANDING_DOCUMENT_PAGE);
  if (activeView === "blog") {
    const post = BLOG_POSTS.find((candidate) => candidate.id === blogPostId) ?? VISIBLE_BLOG_POSTS[0];
    return docPageToMarkdown(post.page);
  }
  return docPage ? docPageToMarkdown(docPage) : undefined;
};

const branchLabelForLocation = (activeTab: ProjectTabId, activeView: LandingView) => {
  if (activeTab === "agentic-kanban") return "release-plan";
  if (activeTab !== "docs") return activeTab;
  if (activeView === "guide-getting-started") return "quickstart";
  if (activeView === "gallery") return "extensions";
  if (activeView === "start") return "main";
  return "docs";
};

interface LandingContentProps {
  activeTab: ProjectTabId;
  activeView: LandingView;
  blogPostId?: string;
  blogPostListOpen: boolean;
  docPage?: DocPage;
  onNavigate: (view: LandingView) => void;
  onPostListOpenChange: (open: boolean) => void;
  onSelectBlogPost: (postId: string) => void;
}

const LandingContent = (props: LandingContentProps) => {
  const {
    activeTab,
    activeView,
    blogPostId,
    blogPostListOpen,
    docPage,
    onNavigate,
    onPostListOpenChange,
    onSelectBlogPost,
  } = props;

  if (activeTab === "agentic-kanban") return <AgenticKanbanView />;
  if (activeView === "guide-getting-started") return <QuickstartView />;
  if (activeView === "gallery") return <ExtensionGallery />;
  if (activeView === "blog") {
    return (
      <BlogView
        activePostId={blogPostId}
        postListOpen={blogPostListOpen}
        onPostListOpenChange={onPostListOpenChange}
        onSelectPost={onSelectBlogPost}
      />
    );
  }
  if (activeView === "why-prompt-studio") return <WhyPromptStudioView onNavigate={onNavigate} />;
  if (docPage) {
    return (
      <Flex justify="center">
        <DocView page={docPage} />
      </Flex>
    );
  }
  return (
    <Flex justify="center">
      <LandingDocument onNavigate={onNavigate} />
    </Flex>
  );
};

export const WorkbenchLanding = (props: WorkbenchLandingProps) => {
  const { initialPath } = props;
  const [location, setLocation] = useState(() => landingLocationFromPath(initialPath));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [blogPostListOpen, setBlogPostListOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const { activeTab, activeView, blogPostId } = location;
  const docPage = DOC_PAGES[activeView];
  const resourceTitle = resolveResourceTitle(activeView, docPage, blogPostId);
  const resourceMarkdown = resolveResourceMarkdown(activeView, docPage, blogPostId);
  const hasWorkbenchBody = activeTab === "docs" || activeTab === "agentic-kanban";
  const branchLabel = branchLabelForLocation(activeTab, activeView);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePopState = () => setLocation(landingLocationFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const updateLocation = (nextLocation: LandingLocation) => {
    const path = landingPathForLocation(nextLocation);
    setLocation(nextLocation);
    if (path !== window.location.pathname) window.history.pushState({}, "", path);
  };

  const navigate = (view: LandingView) => {
    updateLocation({ activeTab: "docs", activeView: view });
  };

  const selectTab = (tab: ProjectTabId) => {
    updateLocation({ activeTab: tab, activeView });
  };

  const selectBlogPost = (postId: string) => {
    updateLocation({
      activeTab: "docs",
      activeView: "blog",
      blogPostId: postId,
    });
  };

  return (
    <Flex direction="column" height="100dvh" position="relative" bg="bg" color="fg" overflow="hidden">
      <ProjectTabsBar activeTab={activeTab} branchLabel={branchLabel} onSelectTab={selectTab} />
      {hasWorkbenchBody && (
        <>
          <Flex flex="1" minHeight="0">
            {sidebarOpen && (
              <ResourceSidebar
                width={sidebarWidth}
                activeView={activeTab === "agentic-kanban" ? "guide-getting-started" : activeView}
                onResize={setSidebarWidth}
                onClose={() => setSidebarOpen(false)}
                onNavigate={navigate}
              />
            )}
            <Flex direction="column" flex="1" minWidth="0">
              <WorkbenchNav
                activeTab={activeTab}
                activeView={activeView}
                resourceMarkdown={resourceMarkdown}
                resourceTitle={resourceTitle}
                sidebarOpen={sidebarOpen}
                showPostListOpener={activeView === "blog" && !blogPostListOpen}
                onSelectTab={selectTab}
                onNavigate={navigate}
                onOpenNavigation={() => setPaletteOpen(true)}
                onOpenPostList={() => setBlogPostListOpen(true)}
                onToggleSidebar={() => setSidebarOpen((open) => !open)}
              />
              <Box as="main" flex="1" minHeight="0" position="relative">
                <Box position="absolute" inset="0" overflowY={activeView === "blog" ? "hidden" : "auto"}>
                  <LandingContent
                    activeTab={activeTab}
                    activeView={activeView}
                    blogPostId={blogPostId}
                    blogPostListOpen={blogPostListOpen}
                    docPage={docPage}
                    onNavigate={navigate}
                    onPostListOpenChange={setBlogPostListOpen}
                    onSelectBlogPost={selectBlogPost}
                  />
                </Box>
              </Box>
            </Flex>
          </Flex>
          <WorkbenchStatusBar
            label={activeTab === "docs" && activeView === "start" ? "changelog" : branchLabel}
            onOpenChangelog={() => setChangelogOpen(true)}
          />
        </>
      )}
      <IconButton
        aria-label="Open Prompt Studio assistant"
        variant="outline"
        size="sm"
        position="absolute"
        right={{ base: "16px", md: "24px" }}
        bottom={{ base: "18px", md: hasWorkbenchBody ? "50px" : "22px" }}
        zIndex="2"
        bg="bg"
        rounded="full"
        display={activeTab === "agentic-kanban" ? { base: "inline-flex", md: "none" } : "inline-flex"}
        onClick={() => setPaletteOpen(true)}
      >
        <MessageCircle size={19} />
      </IconButton>
      <CommandPaletteModal
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        onSelectTab={selectTab}
        onOpenChangelog={() => setChangelogOpen(true)}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </Flex>
  );
};
