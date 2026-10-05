import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { BlogIndexView } from "../../components/blog/blog-index-view";
import { PostView } from "../../components/blog/post-view";
import { DocsHomeView } from "../../components/docs/docs-home-view";
import { DocsPageView } from "../../components/docs/docs-page-view";
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
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const TabBar = (props: { selected: SiteSection }) => (
  <ProjectTabsBar
    windowed={false}
    selected={props.selected}
    sectionPath={(section) => SECTION_HOME[section]}
    onToggleWindowed={noop}
    onTitleBarPointerDown={noop}
    onTitleBarDoubleClick={noop}
  />
);

export const TabBarDocsSelected: Story = { render: () => <TabBar selected="docs" /> };

export const TabBarBlogSelected: Story = { render: () => <TabBar selected="blog" /> };

export const DocsSidebar: Story = {
  render: () => (
    <Box width="220px" height="full">
      <ResourceSidebar page={STORY_SESSIONS} pages={STORY_PAGES} onNavigate={noop} />
    </Box>
  ),
};

export const BlogSidebar: Story = {
  render: () => (
    <Box width="220px" height="full">
      <ResourceSidebar page={STORY_POST} pages={STORY_PAGES} onNavigate={noop} />
    </Box>
  ),
};

export const DocsHome: Story = { render: () => <DocsHomeView page={STORY_DOCS_HOME} pages={STORY_PAGES} /> };

/** Tables, code, and the outline. The outline appears from the `xl` breakpoint. */
export const DocsPage: Story = {
  render: () => <DocsPageView page={STORY_SESSIONS} pages={STORY_PAGES} document={STORY_DOCUMENT} />,
};

export const BlogIndex: Story = { render: () => <BlogIndexView page={STORY_BLOG_HOME} pages={STORY_PAGES} /> };

export const BlogIndexMobile: Story = {
  render: () => (
    <Box width="full" maxWidth="sm" height="full">
      <BlogIndexView page={STORY_BLOG_HOME} pages={STORY_PAGES} />
    </Box>
  ),
};

export const BlogIndexLongTitle: Story = {
  render: () => (
    <BlogIndexView
      page={STORY_BLOG_HOME}
      pages={[{ ...STORY_POST, label: "In the future, your users will be part of the development team." }]}
    />
  ),
};

export const PostOutline: Story = {
  render: () => <PostView page={STORY_POST} document={STORY_POST_OUTLINE_DOCUMENT} />,
};

export const PostHeader: Story = { render: () => <PostView page={STORY_POST} document={STORY_POST_DOCUMENT} /> };

export const PostHeaderLongTitle: Story = {
  render: () => (
    <PostView
      page={{ ...STORY_POST, label: "Prompt Studio 0.39: tools that stay in sync" }}
      document={STORY_POST_DOCUMENT}
    />
  ),
};

export const PostHeaderMobile: Story = {
  render: () => (
    <Box width="full" maxWidth="sm" height="full">
      <PostView page={STORY_POST} document={STORY_POST_DOCUMENT} />
    </Box>
  ),
};
