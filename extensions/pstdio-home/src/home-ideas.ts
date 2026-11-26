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
  {
    id: "virtual-office",
    title: "Virtual office",
    description: "A tiny pixel-art world where your agents work, meet, and bring your project to life.",
    prompt:
      "Turn this project's Home extension into an original top-down isometric pixel-art virtual office inspired by classic handheld RPGs. Give active coding-agent sessions their own characters and desks. Show working, waiting, and finished states in the scene. Let me select a character or desk to open the real session. Add a cozy meeting area, plants, and a garden. Support light and dark themes, keyboard navigation, and reduced motion. Use the project's real sessions and public extension APIs. Create original art without existing game characters or assets.",
  },
] as const;

export type HomeIdeaId = (typeof homeIdeas)[number]["id"];

// The assets/home-idea-screenshots-v1 tag retains this immutable landing-site asset revision.
const screenshotBase =
  "https://raw.githubusercontent.com/pufflyai/prompt-studio/0ed498bdcc/clients/landing-page/public/images/home-ideas";

export const homeIdeaScreenshotUrl = (idea: HomeIdeaId, mode: "light" | "dark") =>
  `${screenshotBase}/${idea}-${mode}.png`;
