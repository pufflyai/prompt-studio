import type { SidebarView } from "../content/landing-content";
import { LANDING_PAGES, type LandingPage, type SiteSection } from "../content/landing-pages";
import type { ToolExampleId } from "../content/tool-examples-content";

export const landingPathForView = (view: SidebarView) => LANDING_PAGES.find((page) => page.view === view)!.path;

export const landingPathForExample = (exampleId: ToolExampleId) =>
  LANDING_PAGES.find((page) => page.view === "examples" && page.exampleId === exampleId)!.path;

export const landingPageFromPath = (pages: LandingPage[], path: string) => {
  const pathname = `${path.split(/[?#]/)[0].replace(/\/+$/, "")}/`;
  if (pathname === "/examples/") return pages.find((page) => page.view === "examples");
  return pages.find((page) => page.path === pathname);
};

/** Served paths: every page, plus `/examples/`, which shows the first example. */
export const servedPaths = (pages: LandingPage[]) => [...pages.map((page) => page.path), "/examples/"];

export const SECTION_HOME: Record<SiteSection, string> = { studio: "/", docs: "/docs/", blog: "/blog/" };

export const sectionForPage = (page: LandingPage): SiteSection => {
  if (page.view === "docs" || page.view === "doc") return "docs";
  if (page.view === "blog" || page.view === "post") return "blog";
  return "studio";
};

/** Pages whose main content is markdown HTML that the site fetches on navigation. */
export const isDocumentPage = (page: LandingPage) => ["legal", "doc", "post"].includes(page.view);
