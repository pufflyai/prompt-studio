import type { ToolShapeKind } from "../shapes/tool-shapes";

export const REASONS: { title: string; body: string; marks: ToolShapeKind[] }[] = [
  {
    title: "All your vibe coded tools under one roof",
    body: "Your dashboards, trackers, and little utilities belong together. Build them in Prompt Studio and open them side by side, in the same app.",
    marks: ["page", "command"],
  },
  {
    title: "Build for the way you work",
    body: "Describe the tool you wish you had. Your agent can build a page, an editor, or a shortcut around the way you do things. Try it, then ask for the changes you want.",
    marks: ["hook"],
  },
  {
    title: "Let your tools work together",
    body: "Use the output of one tool in another. Turn research into a report, or a report into a list of tasks. Connect the tools you build as your work grows.",
    marks: ["command", "page"],
  },
  {
    title: "Give your agent the same tools",
    body: "Open a tool and use it yourself, or ask your agent to do the work. You can both use the same commands and work with the same project files.",
    marks: ["automation"],
  },
  {
    title: "Make everyday tasks automatic",
    body: "Ask your agent to schedule a daily summary or run a check when work finishes. Your tools can keep doing useful work without you opening each one.",
    marks: ["skill"],
  },
  {
    title: "Keep making them your own",
    body: "Your tools live in your repository. Change how they look, add a feature, or share the code with someone who needs the same thing.",
    marks: ["editor", "automation"],
  },
];
