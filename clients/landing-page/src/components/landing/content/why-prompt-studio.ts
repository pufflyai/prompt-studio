import type { DocPage } from "../doc-view";

export const WHY_TITLE = "Why Prompt Studio";
export const WHY_INTRO = "Your agents can write code. Prompt Studio helps them build the workflow around it.";
export const WHY_QUOTE =
  "Prompt Studio turns workflow friction into project-local tools your agents can build, your team can inspect, and your workbench can run.";

export interface WhyPillar {
  title: string;
  body: string;
}

export const WHY_PILLARS: WhyPillar[] = [
  {
    title: "Your workflow should not have to fit the tool",
    body: "Most agent orchestration products encode one way of planning, delegating, and reviewing work. That is useful until your team needs a different approval, a project-specific check, or a view that the product did not anticipate.",
  },
  {
    title: "Build the missing surface",
    body: "Prompt Studio is an extensible workbench rather than a fixed workflow. Ask your coding agent for the command, panel, editor, automation, template, or skill you need; the result becomes part of the project instead of another disconnected script.",
  },
  {
    title: "Keep humans in control",
    body: "Projects, workspaces, sessions, approvals, and outputs stay visible in one place. Your team can inspect what an agent is doing, intervene when judgment matters, and preserve the workflow that produced the result.",
  },
  {
    title: "Bring the agents you already trust",
    body: "Prompt Studio does not replace Codex, Claude Code, or OpenCode. Harness extensions connect them to the same project context and workbench, so you can improve the surrounding system without changing the agent that writes the code.",
  },
];

export interface WhyFeature {
  id: string;
  label: string;
  body: string;
  image: string;
  alt: string;
}

export const WHY_FEATURES: WhyFeature[] = [
  {
    id: "search",
    label: "search / ⌘K",
    body: "Everything in the workbench is a resource, and every resource is one keystroke away. Projects, workspaces, docs, and the views your extensions add all land in the same palette.",
    image: "/images/why/search.png",
    alt: "The command palette listing navigation targets and commands",
  },
  {
    id: "notifications",
    label: "notifications",
    body: "Agents finish, approvals wait, releases ship. It all lands in one inbox you can search, triage, and clear — instead of a dozen tabs asking for attention.",
    image: "/images/why/notifications.png",
    alt: "The notification inbox with a release announcement and a welcome notification",
  },
  {
    id: "panels",
    label: "panels",
    body: "Split the surface the way you work: your data above, a live terminal below, your agent beside them. The workbench restores the layout — and the terminal tabs — next time you open it.",
    image: "/images/why/panels.png",
    alt: "A workbench view with a data table on top and a terminal panel below",
  },
  {
    id: "navigation",
    label: "navigation",
    body: "Back and forward work like a browser. Breadcrumbs always know where you are, and history carries you across views, editors, and extension pages.",
    image: "/images/why/navigation.png",
    alt: "The breadcrumb navigation showing a project, section, and page",
  },
];

export const whyPromptStudioPage: DocPage = {
  title: WHY_TITLE,
  intro: WHY_INTRO,
  blocks: [
    { type: "quote", text: WHY_QUOTE },
    ...WHY_PILLARS.flatMap((pillar): DocPage["blocks"] => [
      { type: "heading", text: pillar.title },
      { type: "paragraph", text: pillar.body },
    ]),
    { type: "heading", text: "The workbench, up close" },
    ...WHY_FEATURES.flatMap((feature): DocPage["blocks"] => [
      { type: "paragraph", text: `**${feature.label}** — ${feature.body}` },
      { type: "image", src: feature.image, alt: feature.alt },
    ]),
  ],
};
