import { Box, Flex } from "@chakra-ui/react";
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
import { DocumentationReader } from "./documentation-reader";
import { ExtensionGallery } from "./extension-gallery";
import type { LandingView, ProjectTabId } from "./landing-content";
import { LANDING_DOCUMENT_PAGE, LandingDocument } from "./landing-document";
import { type LandingLocation, landingLocationFromPath, landingPathForLocation } from "./landing-route";
import { ProjectTabsBar } from "./project-tabs-bar";
import { QuickstartView } from "./quickstart-view";
import {
  type RepositoryDocument,
  repositoryDocPathFromUrl,
  repositoryDocument,
  resolveRepositoryDocUrl,
} from "./repository-docs";
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

const resolveResourceTitle = (
  activeView: LandingView,
  docPage: DocPage | undefined,
  repositoryDoc: RepositoryDocument | undefined,
  blogPostId?: string,
) => {
  if (activeView === "blog") return (BLOG_POSTS.find((post) => post.id === blogPostId) ?? VISIBLE_BLOG_POSTS[0]).title;
  if (activeView === "documentation") return repositoryDoc?.title;
  return docPage?.title;
};

const resolveResourceMarkdown = (
  activeView: LandingView,
  docPage: DocPage | undefined,
  repositoryDoc: RepositoryDocument | undefined,
  blogPostId?: string,
) => {
  if (activeView === "start") return docPageToMarkdown(LANDING_DOCUMENT_PAGE);
  if (activeView === "documentation") return repositoryDoc?.markdown;
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
  repositoryDoc?: RepositoryDocument;
  onNavigate: (view: LandingView) => void;
  onNavigateDoc: (path: string) => void;
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
    repositoryDoc,
    onNavigate,
    onNavigateDoc,
    onPostListOpenChange,
    onSelectBlogPost,
  } = props;

  if (activeTab === "agentic-kanban") return <AgenticKanbanView />;
  if (activeView === "guide-getting-started") return <QuickstartView onNavigateDoc={onNavigateDoc} />;
  if (activeView === "documentation" && repositoryDoc) {
    return (
      <DocumentationReader
        markdown={repositoryDoc.markdown}
        onNavigateDoc={onNavigateDoc}
        resolveMarkdownUrl={(source, kind) => resolveRepositoryDocUrl(source, repositoryDoc.path, kind)}
        resolvePathFromUrl={repositoryDocPathFromUrl}
      />
    );
  }
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
      <Flex height="100%" justify="center">
        <DocView page={docPage} />
      </Flex>
    );
  }
  return (
    <Box height="100%" overflowY="auto">
      <Flex justify="center">
        <LandingDocument onNavigate={onNavigate} />
      </Flex>
    </Box>
  );
};

export const WorkbenchLanding = (props: WorkbenchLandingProps) => {
  const { initialPath } = props;
  const [location, setLocation] = useState(() => landingLocationFromPath(initialPath, repositoryDocPathFromUrl));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [blogPostListOpen, setBlogPostListOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const { activeTab, activeView, blogPostId, docPath } = location;
  const docPage = DOC_PAGES[activeView];
  const activeRepositoryDoc = activeView === "documentation" ? repositoryDocument(docPath) : undefined;
  const resourceTitle = resolveResourceTitle(activeView, docPage, activeRepositoryDoc, blogPostId);
  const resourceMarkdown = resolveResourceMarkdown(activeView, docPage, activeRepositoryDoc, blogPostId);
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
    const handlePopState = () =>
      setLocation(landingLocationFromPath(window.location.pathname, repositoryDocPathFromUrl));
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

  const navigateDoc = (path: string) => {
    updateLocation({ activeTab: "docs", activeView: "documentation", docPath: path });
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
      <ProjectTabsBar
        activeTab={activeTab}
        branchLabel={branchLabel}
        onNavigateHome={() => navigate("start")}
        onSelectTab={selectTab}
      />
      {hasWorkbenchBody && (
        <>
          <Flex flex="1" minHeight="0">
            {activeTab === "docs" && sidebarOpen && (
              <ResourceSidebar
                width={sidebarWidth}
                activeDocPath={docPath}
                activeView={activeTab === "agentic-kanban" ? "guide-getting-started" : activeView}
                onResize={setSidebarWidth}
                onClose={() => setSidebarOpen(false)}
                onNavigate={navigate}
                onNavigateDoc={navigateDoc}
              />
            )}
            <Flex direction="column" flex="1" minWidth="0">
              <WorkbenchNav
                activeTab={activeTab}
                activeView={activeView}
                docPath={docPath}
                resourceMarkdown={resourceMarkdown}
                resourceTitle={resourceTitle}
                sidebarAvailable={activeTab === "docs"}
                sidebarOpen={sidebarOpen}
                showPostListOpener={activeView === "blog" && !blogPostListOpen}
                onSelectTab={selectTab}
                onNavigate={navigate}
                onNavigateDoc={navigateDoc}
                onOpenNavigation={() => setPaletteOpen(true)}
                onOpenPostList={() => setBlogPostListOpen(true)}
                onToggleSidebar={() => setSidebarOpen((open) => !open)}
              />
              <Box as="main" flex="1" minHeight="0" position="relative">
                <Box position="absolute" inset="0" overflow="hidden">
                  <LandingContent
                    activeTab={activeTab}
                    activeView={activeView}
                    blogPostId={blogPostId}
                    blogPostListOpen={blogPostListOpen}
                    docPage={docPage}
                    repositoryDoc={activeRepositoryDoc}
                    onNavigate={navigate}
                    onNavigateDoc={navigateDoc}
                    onPostListOpenChange={setBlogPostListOpen}
                    onSelectBlogPost={selectBlogPost}
                  />
                </Box>
              </Box>
            </Flex>
          </Flex>
          <WorkbenchStatusBar label="changelog" onNavigate={navigate} onOpenChangelog={() => setChangelogOpen(true)} />
        </>
      )}
      <CommandPaletteModal
        open={paletteOpen}
        sidebarAvailable={activeTab === "docs"}
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
