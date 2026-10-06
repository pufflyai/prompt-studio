import { DOCS_SECTIONS, DOCS_TOPICS } from "../content/docs-topics";
import type { LandingPage } from "../content/landing-pages";

/** Sidebar sections with their topics and pages, in allow-list order. Empty topics are left out. */
export const docsTree = (pages: LandingPage[]) =>
  DOCS_SECTIONS.map((section) => ({
    section,
    topics: DOCS_TOPICS.filter((topic) => topic.section === section)
      .map((topic) => ({
        topic,
        pages: pages.filter((page) => page.view === "doc" && page.path.startsWith(topic.path)),
      }))
      .filter((entry) => entry.pages.length > 0),
  })).filter((entry) => entry.topics.length > 0);
