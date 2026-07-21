import { Box, Flex } from "@chakra-ui/react";
import type { NotificationCenterItem } from "@pstdio/ui";
import { useEffect, useState } from "react";
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
import { DotLatticeBackground } from "./dot-lattice-background";
import { ExtensionGallery } from "./extension-gallery";
import type { LandingView, ProjectTabId } from "./landing-content";
import { LANDING_DOCUMENT_PAGE, LandingDocument } from "./landing-document";
import { type LandingLocation, landingLocationFromPath, landingPathForLocation } from "./landing-route";
import { INITIAL_NOTIFICATIONS, NotificationsModal } from "./notifications-modal";
import { ProjectTabsBar } from "./project-tabs-bar";
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

export const WorkbenchLanding = (props: WorkbenchLandingProps) => {
  const { initialPath } = props;
  const [location, setLocation] = useState(() => landingLocationFromPath(initialPath));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [blogPostListOpen, setBlogPostListOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const { activeTab, activeView, blogPostId } = location;
  const unreadCount = notifications.filter((item) => item.status === "open").length;
  const docPage = DOC_PAGES[activeView];
  const resourceTitle = resolveResourceTitle(activeView, docPage, blogPostId);
  const resourceMarkdown = resolveResourceMarkdown(activeView, docPage, blogPostId);

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

  const closeNotifications = () => {
    setNotificationsOpen(false);
    setNotifications((items) => items.map((item) => (item.status === "open" ? { ...item, status: "read" } : item)));
  };

  const dismissNotification = (item: NotificationCenterItem) => {
    setNotifications((items) => items.filter((candidate) => candidate.id !== item.id));
  };

  return (
    <Flex direction="column" height="100dvh" bg="bg" color="fg" overflow="hidden">
      <ProjectTabsBar activeTab={activeTab} onSelectTab={selectTab} />
      <Flex flex="1" minHeight="0">
        {sidebarOpen && (
          <ResourceSidebar
            width={sidebarWidth}
            activeView={activeView}
            unreadCount={unreadCount}
            onResize={setSidebarWidth}
            onClose={() => setSidebarOpen(false)}
            onNavigate={navigate}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onOpenChangelog={() => setChangelogOpen(true)}
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
            onOpenPostList={() => setBlogPostListOpen(true)}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
          />
          <Box as="main" flex="1" minHeight="0" position="relative">
            <DotLatticeBackground />
            <Box position="absolute" inset="0" overflowY={activeView === "blog" ? "hidden" : "auto"}>
              {activeView === "gallery" ? (
                <ExtensionGallery />
              ) : activeView === "blog" ? (
                <BlogView
                  activePostId={blogPostId}
                  postListOpen={blogPostListOpen}
                  onPostListOpenChange={setBlogPostListOpen}
                  onSelectPost={selectBlogPost}
                />
              ) : activeView === "why-prompt-studio" ? (
                <WhyPromptStudioView onNavigate={navigate} />
              ) : docPage ? (
                <Flex justify="center">
                  <DocView page={docPage} />
                </Flex>
              ) : (
                <Flex justify="center">
                  <LandingDocument onNavigate={navigate} />
                </Flex>
              )}
            </Box>
          </Box>
        </Flex>
      </Flex>
      <WorkbenchStatusBar />
      <CommandPaletteModal
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        onOpenChangelog={() => setChangelogOpen(true)}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <NotificationsModal
        open={notificationsOpen}
        items={notifications}
        onClose={closeNotifications}
        onDismiss={dismissNotification}
        onOpenChangelog={() => setChangelogOpen(true)}
      />
    </Flex>
  );
};
