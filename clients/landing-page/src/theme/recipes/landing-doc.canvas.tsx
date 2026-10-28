import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { BlogIndexView } from "../../components/blog/blog-index-view";
import { PostView } from "../../components/blog/post-view";
import { DocsHomeView } from "../../components/docs/docs-home-view";
import { DocsPageView } from "../../components/docs/docs-page-view";
import { CommandPaletteModal } from "../../components/workbench/command-palette-modal";
import { ProjectTabsBar } from "../../components/workbench/project-tabs-bar";
import { ResourceSidebar } from "../../components/workbench/resource-sidebar";
import type { SiteSection } from "../../content/landing-pages";
import { SECTION_HOME } from "../../services/landing-route";
import {
  STORY_BLOG_HOME,
  STORY_DOCS_HOME,
  STORY_DOCUMENT,
  STORY_PAGES,
  STORY_POST,
  STORY_POST_DOCUMENT,
  STORY_POST_OUTLINE_DOCUMENT,
  STORY_SESSIONS,
} from "./landing-doc.fixtures";

const noop = () => {};
const meta = {
  title: "Landing/Docs and blog",
  decorators: [
    (Story) => (
      <Box height="720px" bg="bg.subtle" p="panel-gap" display="flex" flexDirection="column">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta;
export default meta;
type Story = CanvasVariant<typeof meta>;
const TabBar = (props: { selected: SiteSection }) => (
  <ProjectTabsBar
    windowed={false}
    selected={props.selected}
    sectionPath={(section) => SECTION_HOME[section]}
    onToggleWindowed={noop}
    onTitleBarPointerDown={noop}
    onTitleBarDoubleClick={noop}
    actionMenuOpen={false}
    onOpenActionMenu={noop}
  />
);
export const TabBarDocsSelected: Story = {
  id: "landing-docs-and-blog--tab-bar-docs-selected",
  render: () => <TabBar selected="docs" />,
};
export const TabBarBlogSelected: Story = {
  id: "landing-docs-and-blog--tab-bar-blog-selected",
  render: () => <TabBar selected="blog" />,
};
const ActionMenuTitleBar = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ProjectTabsBar
        windowed={false}
        selected="blog"
        sectionPath={(section) => SECTION_HOME[section]}
        onToggleWindowed={noop}
        onTitleBarPointerDown={noop}
        onTitleBarDoubleClick={noop}
        actionMenuOpen={open}
        onOpenActionMenu={() => setOpen(true)}
      />
      <CommandPaletteModal open={open} pages={STORY_PAGES} onClose={() => setOpen(false)} onNavigate={noop} />
    </>
  );
};
export const TabBarActionMenu: Story = {
  id: "landing-docs-and-blog--tab-bar-action-menu",
  render: () => <ActionMenuTitleBar />,
};
export const MobileNavigation: Story = {
  id: "landing-docs-and-blog--mobile-navigation",
  render: () => <CommandPaletteModal open pages={STORY_PAGES} onClose={noop} onNavigate={noop} />,
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: {
    docs: { description: { story: "Mobile navigation fills the screen without focusing search on open." } },
  },
};
export const TabBarActionMenuDark: Story = {
  id: "landing-docs-and-blog--tab-bar-action-menu-dark",
  render: () => (
    <Box className="dark">
      <ActionMenuTitleBar />
    </Box>
  ),
};
export const DocsSidebar: Story = {
  id: "landing-docs-and-blog--docs-sidebar",
  render: () => (
    <Box width="220px" height="full">
      <ResourceSidebar page={STORY_SESSIONS} pages={STORY_PAGES} onNavigate={noop} />
    </Box>
  ),
};
export const DocsSidebarShortWindow: Story = {
  id: "landing-docs-and-blog--docs-sidebar-short-window",
  render: () => (
    <Box width="220px" height="320px">
      <ResourceSidebar page={STORY_SESSIONS} pages={STORY_PAGES} onNavigate={noop} />
    </Box>
  ),
  parameters: {
    docs: {
      description: { story: "Long navigation remains scrollable in a short window without a visible scrollbar." },
    },
  },
};
export const BlogSidebar: Story = {
  id: "landing-docs-and-blog--blog-sidebar",
  render: () => (
    <Box width="220px" height="full">
      <ResourceSidebar page={STORY_POST} pages={STORY_PAGES} onNavigate={noop} />
    </Box>
  ),
};
export const DocsHome: Story = {
  id: "landing-docs-and-blog--docs-home",
  render: () => <DocsHomeView page={STORY_DOCS_HOME} pages={STORY_PAGES} />,
};
export const DocsHomeMobile: Story = {
  id: "landing-docs-and-blog--docs-home-mobile",
  ...DocsHome,
  parameters: {
    docs: { description: { story: "Mobile docs links fill their row and have a minimum 44-pixel touch target." } },
  },
};
export const DocsPageMobile: Story = {
  id: "landing-docs-and-blog--docs-page-mobile",
  render: () => <DocsPageView page={STORY_SESSIONS} document={STORY_DOCUMENT} />,
  parameters: {
    docs: { description: { story: "Inline documentation links have added padding and height on mobile." } },
  },
};
/** Tables, code, and the outline. The outline appears from the `xl` breakpoint. */
export const DocsPage: Story = {
  id: "landing-docs-and-blog--docs-page",
  render: () => <DocsPageView page={STORY_SESSIONS} document={STORY_DOCUMENT} />,
};
export const BlogIndex: Story = {
  id: "landing-docs-and-blog--blog-index",
  render: () => <BlogIndexView page={STORY_BLOG_HOME} pages={STORY_PAGES} />,
};
export const BlogIndexDark: Story = {
  id: "landing-docs-and-blog--blog-index-dark",
  render: () => (
    <Box className="dark" height="full">
      <BlogIndexView page={STORY_BLOG_HOME} pages={STORY_PAGES} />
    </Box>
  ),
};
export const BlogIndexMobile: Story = {
  id: "landing-docs-and-blog--blog-index-mobile",
  render: () => (
    <Box width="full" maxWidth="sm" height="full">
      <BlogIndexView page={STORY_BLOG_HOME} pages={STORY_PAGES} />
    </Box>
  ),
};
export const BlogIndexLongTitle: Story = {
  id: "landing-docs-and-blog--blog-index-long-title",
  render: () => (
    <BlogIndexView
      page={STORY_BLOG_HOME}
      pages={[{ ...STORY_POST, label: "In the future, your users will be part of the development team." }]}
    />
  ),
};
export const PostOutline: Story = {
  id: "landing-docs-and-blog--post-outline",
  render: () => <PostView page={STORY_POST} document={STORY_POST_OUTLINE_DOCUMENT} />,
};
export const PostHeader: Story = {
  id: "landing-docs-and-blog--post-header",
  render: () => <PostView page={STORY_POST} document={STORY_POST_DOCUMENT} />,
};
const ReleasePost = () => (
  <PostView page={{ ...STORY_POST, label: "Prompt Studio 0.39", category: "release" }} document={STORY_POST_DOCUMENT} />
);
export const ReleaseAlphaNotice: Story = {
  id: "landing-docs-and-blog--release-alpha-notice",
  render: () => <ReleasePost />,
};
export const ReleaseAlphaNoticeDark: Story = {
  id: "landing-docs-and-blog--release-alpha-notice-dark",
  render: () => (
    <Box className="dark" height="full">
      <ReleasePost />
    </Box>
  ),
};
export const ReleaseAlphaNoticeMobile: Story = {
  id: "landing-docs-and-blog--release-alpha-notice-mobile",
  render: () => (
    <Box width="full" maxWidth="sm" height="full">
      <ReleasePost />
    </Box>
  ),
};
export const PostHeaderDark: Story = {
  id: "landing-docs-and-blog--post-header-dark",
  render: () => (
    <Box className="dark" height="full">
      <PostView page={STORY_POST} document={STORY_POST_DOCUMENT} />
    </Box>
  ),
};
export const PostHeaderLongTitle: Story = {
  id: "landing-docs-and-blog--post-header-long-title",
  render: () => (
    <PostView
      page={{ ...STORY_POST, label: "Prompt Studio 0.39: tools that stay in sync" }}
      document={STORY_POST_DOCUMENT}
    />
  ),
};
export const PostHeaderMobile: Story = {
  id: "landing-docs-and-blog--post-header-mobile",
  render: () => (
    <Box width="full" maxWidth="sm" height="full">
      <PostView page={STORY_POST} document={STORY_POST_DOCUMENT} />
    </Box>
  ),
};
