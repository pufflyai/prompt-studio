import type { ToolShapeKind } from "../shapes/tool-shapes";

export type ToolExampleId = "research" | "feedback" | "brief";

export const TOOL_EXAMPLES: {
  id: ToolExampleId;
  name: string;
  description: string;
  blocks: { kind: ToolShapeKind; purpose: string }[];
}[] = [
  {
    id: "research",
    name: "Research desk",
    description: "Keep your sources beside the brief you are writing.",
    blocks: [
      { kind: "page", purpose: "A library gives your sources a place to live." },
      { kind: "editor", purpose: "An editor opens the brief beside your research." },
      { kind: "command", purpose: "A command turns the selected sources into a draft brief." },
      { kind: "skill", purpose: "A skill gives your agent the research method and brief format you use." },
    ],
  },
  {
    id: "feedback",
    name: "Feedback board",
    description: "Turn customer feedback into a plan you can act on.",
    blocks: [
      { kind: "page", purpose: "A board groups feedback so you can decide what to work on." },
      { kind: "command", purpose: "A command brings new feedback into the board." },
      { kind: "hook", purpose: "A hook updates the board when an agent finishes a review." },
    ],
  },
  {
    id: "brief",
    name: "Daily brief",
    description: "Open your workbench to a summary of what needs your attention.",
    blocks: [
      { kind: "page", purpose: "A page puts the summary and its sources in one view." },
      { kind: "command", purpose: "A command collects the updates and prepares a brief." },
      { kind: "automation", purpose: "A schedule runs the brief command every weekday morning." },
    ],
  },
];

export const RESEARCH_SOURCES = [
  {
    title: "Customer interviews",
    meta: "6 conversations",
    finding: "New customers want one clear place to start.",
    action: "Simplify the first screen",
  },
  {
    title: "Onboarding notes",
    meta: "12 observations",
    finding: "A useful example helps people get to their first result.",
    action: "Add a guided example",
  },
  {
    title: "Support conversations",
    meta: "8 questions",
    finding: "People want to see what changed and what to do next.",
    action: "Make the next step visible",
  },
];

export const FEEDBACK_ITEMS = [
  { title: "Export a report as PDF", owner: "Alex", status: "To review" },
  { title: "Show active filters", owner: "Sam", status: "Planned" },
  { title: "Keep my last view", owner: "Alex", status: "Planned" },
  { title: "Add a weekly digest", owner: "Sam", status: "To review" },
];
