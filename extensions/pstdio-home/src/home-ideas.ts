export const homeIdeas = [
  {
    id: "project-pulse",
    title: "Project pulse",
    description: "Recent activity, work in progress, and what needs your attention.",
    prompt:
      "Customize this project's Home extension with a project dashboard. Summarize recent activity, work in progress, and the next three things I should look at. Link each item to its source. Use this project's real data and shared UI components.",
  },
  {
    id: "release-checklist",
    title: "Release checklist",
    description: "A clear view of release checks, blockers, and what is ready to ship.",
    prompt:
      "Turn this project's Home extension into a release checklist. Show the current release, open blockers, and status of the checks I need before shipping. Link to the relevant tickets and pull requests. Use this project's real data and shared UI components.",
  },
  {
    id: "team-handoff",
    title: "Team handoff",
    description: "Changes, open decisions, and follow-ups for the next person.",
    prompt:
      "Build a handoff view in this project's Home extension. Show what changed since the last handoff, decisions still open, and the people or tickets to follow up with. Use this project's real data and shared UI components.",
  },
  {
    id: "launchpad",
    title: "Launchpad",
    description: "Your recurring commands and useful project views, one click away.",
    prompt:
      "Make this project's Home extension a launchpad for the work I repeat. Inspect this project, identify useful commands and views, and add shortcuts to run or open them. Use existing public extension commands and shared UI components.",
  },
] as const;

export type HomeIdeaId = (typeof homeIdeas)[number]["id"];
