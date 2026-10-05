import { siteMetadata } from "../config/site-metadata";
import { type LandingView, VIEW_META } from "./landing-content";
import { TOOL_EXAMPLES, type ToolExampleId } from "./tool-examples-content";

interface PageFields {
  path: string;
  /** Short name in navigation: sidebar rows, palette entries, page links. */
  label: string;
  /** Document title for the browser and search results. */
  title: string;
  description: string;
}

export type LandingPage =
  | (PageFields & { view: Exclude<LandingView, "examples" | "post"> })
  | (PageFields & { view: "examples"; exampleId: ToolExampleId })
  | (PageFields & { view: "post"; published: string; author: ActivityActor; readingMinutes: number; image?: string });

/** The title bar tabs. Every page belongs to one. */
export type SiteSection = "studio" | "docs" | "blog";

/** HTML compiled from markdown at build time, with the headings for the outline. */
export interface LandingDocument {
  html: string;
  headings: { depth: number; slug: string; text: string }[];
}

/** Pages written in code. The page catalog adds the docs pages and posts from markdown. */
export const LANDING_PAGES: LandingPage[] = [
  {
    path: "/",
    view: "start",
    label: VIEW_META.start.label,
    title: siteMetadata.title,
    description: siteMetadata.description,
  },
  {
    path: "/what-is-prompt-studio/",
    view: "what-is-prompt-studio",
    label: VIEW_META["what-is-prompt-studio"].label,
    title: "What is Prompt Studio? | A workbench for your tools",
    description:
      "Give the tools you build a place to live. Combine pages, editors, commands, skills, hooks, and workflows in your own workbench.",
  },
  ...TOOL_EXAMPLES.map((example) => ({
    path: `/examples/${example.slug}/`,
    view: "examples" as const,
    exampleId: example.id,
    label: VIEW_META.examples.label,
    title: `${example.name} example | Prompt Studio`,
    description: example.description,
  })),
  {
    path: "/features/",
    view: "features",
    label: VIEW_META.features.label,
    title: "Shared features for your tools | Prompt Studio",
    description:
      "Try shared search, notifications, navigation, extension management, and themes. Build tools on the features already included in Prompt Studio.",
  },
  // Legal pages read as documents. Their text lives in `src/content/legal/<slug>.md`.
  {
    path: "/privacy/",
    view: "legal",
    label: "Privacy policy",
    title: "Privacy policy | Prompt Studio",
    description: "Read how Pufflig AB handles information when you use Prompt Studio and its website.",
  },
  {
    path: "/terms/",
    view: "legal",
    label: "Terms of service",
    title: "Terms of service | Prompt Studio",
    description: "Read the terms that apply to using Prompt Studio and its website, provided by Pufflig AB.",
  },
  {
    path: "/imprint/",
    view: "legal",
    label: "Imprint",
    title: "Imprint | Prompt Studio",
    description: "Company and contact details for Pufflig AB, the publisher of Prompt Studio.",
  },
  {
    path: "/docs/",
    view: "docs",
    label: "Docs home",
    title: "Docs | Prompt Studio",
    description:
      "Guides and references for Prompt Studio: install it, learn how it works, build extensions, and look up the CLI, SDK, and extension API.",
  },
  {
    path: "/blog/",
    view: "blog",
    label: "All posts",
    title: "Blog | Prompt Studio",
    description: "News, releases, and breaking changes from the people who build Prompt Studio.",
  },
];

import type { ActivityActor } from "@pstdio/ui";
