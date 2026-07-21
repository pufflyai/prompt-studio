import { BLOG_POSTS } from "./content/blog";
import type { LandingView, ProjectTabId } from "./landing-content";

const LANDING_VIEW_PATHS: Record<LandingView, string> = {
  start: "/",
  "why-prompt-studio": "/explore/why-prompt-studio",
  gallery: "/extensions",
  concepts: "/docs/concepts",
  "guide-getting-started": "/guides/getting-started",
  "guide-create-ticket": "/guides/create-a-ticket",
  "guide-implement-ticket": "/guides/implement-a-ticket",
  "guide-create-proposal": "/guides/write-a-proposal",
  "guide-create-sub-tickets": "/guides/create-sub-tickets",
  "guide-refine-ticket": "/guides/refine-a-ticket",
  "guide-create-extension": "/guides/build-an-extension",
  "cli-reference": "/docs/cli",
  "cli-projects": "/docs/cli/projects",
  "cli-workspaces": "/docs/cli/workspaces",
  "cli-agents": "/docs/cli/agents",
  "cli-sessions": "/docs/cli/sessions",
  "cli-extensions": "/docs/cli/extensions-and-serve",
  "cli-planner": "/docs/cli/planner",
  "cli-configuration": "/docs/cli/configuration",
  "sdk-reference": "/docs/sdk",
  "sdk-commands": "/docs/sdk/commands",
  "sdk-views": "/docs/sdk/views-and-renderers",
  "sdk-hooks": "/docs/sdk/hooks-and-schedules",
  "sdk-client": "/docs/sdk/client-and-types",
  "sdk-assets": "/docs/sdk/assets-and-catalog",
  blog: "/blog",
  privacy: "/privacy",
  terms: "/terms",
};

export interface LandingLocation {
  // a single "docs" project today; kept for the workbench chrome that renders the project tab
  activeTab: ProjectTabId;
  activeView: LandingView;
  blogPostId?: string;
}

const normalizePath = (path: string) => {
  const pathname = path.split(/[?#]/)[0];
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
};

export const landingPathForLocation = (location: LandingLocation) => {
  if (location.activeView === "blog" && location.blogPostId) return `/blog/${location.blogPostId}`;
  return LANDING_VIEW_PATHS[location.activeView];
};

export const landingLocationFromPath = (path: string): LandingLocation => {
  const pathname = normalizePath(path);
  const blogPost = BLOG_POSTS.find((post) => `/blog/${post.id}` === pathname);
  if (blogPost) {
    return { activeTab: "docs", activeView: "blog", blogPostId: blogPost.id };
  }

  const view = Object.entries(LANDING_VIEW_PATHS).find(([, candidate]) => candidate === pathname)?.[0] as
    | LandingView
    | undefined;
  return { activeTab: "docs", activeView: view ?? "start" };
};

export const ALL_LANDING_PATHS = [
  ...new Set([...Object.values(LANDING_VIEW_PATHS), ...BLOG_POSTS.map((post) => `/blog/${post.id}`)]),
];
