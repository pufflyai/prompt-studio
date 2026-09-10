import { siteMetadata } from "../config/site-metadata";
import type { LandingView } from "./landing-content";
import { TOOL_EXAMPLES, type ToolExampleId } from "./tool-examples-content";

export interface LandingPage {
  path: string;
  view: LandingView;
  title: string;
  description: string;
  exampleId?: ToolExampleId;
}

export const LANDING_PAGES: LandingPage[] = [
  { path: "/", view: "start", title: siteMetadata.title, description: siteMetadata.description },
  {
    path: "/what-is-prompt-studio/",
    view: "what-is-prompt-studio",
    title: "What is Prompt Studio? | A workbench for your tools",
    description:
      "Give the tools you build a place to live. Combine pages, editors, commands, skills, hooks, and workflows in your own workbench.",
  },
  ...TOOL_EXAMPLES.map((example) => ({
    path: `/examples/${example.slug}/`,
    view: "examples" as const,
    exampleId: example.id,
    title: `${example.name} example | Prompt Studio`,
    description: example.description,
  })),
  {
    path: "/features/",
    view: "features",
    title: "Shared features for your tools | Prompt Studio",
    description:
      "Try shared search, notifications, navigation, extension management, and themes. Build tools on the features already included in Prompt Studio.",
  },
  {
    path: "/privacy/",
    view: "privacy",
    title: "Privacy policy | Prompt Studio",
    description: "Read how Pufflig AB handles information when you use Prompt Studio and its website.",
  },
  {
    path: "/terms/",
    view: "terms",
    title: "Terms of service | Prompt Studio",
    description: "Read the terms that apply to using Prompt Studio and its website, provided by Pufflig AB.",
  },
];
