export const homeIdeas = [
  {
    id: "release-checklist",
    kind: "build",
    title: "Release checklist",
    description: "A clear view of release checks, blockers, and what is ready to ship.",
    prompt:
      "Turn this project's Home extension into a release checklist. Show the current release, open blockers, and status of the checks I need before shipping. Link to the relevant tickets and pull requests. Use this project's real data and shared UI components.",
  },
  {
    id: "virtual-office",
    kind: "build",
    title: "Virtual office",
    description: "A tiny pixel-art world where your agents work, meet, and bring your project to life.",
    prompt:
      "Turn this project's Home extension into an original top-down isometric pixel-art virtual office inspired by classic handheld RPGs. Give active coding-agent sessions their own characters and desks. Show working, waiting, and finished states in the scene. Let me select a character or desk to open the real session. Add a cozy meeting area, plants, and a garden. Support light and dark themes, keyboard navigation, and reduced motion. Use the project's real sessions and public extension APIs. Create original art without existing game characters or assets.",
  },
  {
    id: "something-different",
    kind: "explore",
    title: "Something different",
    description: "Let your agent explore this project and suggest fresh ideas for your Home page.",
    prompt:
      "Inspect this project and its existing Home extension to understand what it does, who uses it, and the work it supports. Suggest 3–5 distinct ways to transform the Home page into something useful or surprising for this particular project. Include practical ideas and at least one imaginative direction. For each idea, explain what it would show or let me do, which real project data or existing extensions it could use, and why it would help. Ask me which direction I want to build. Do not implement changes until I choose an idea.",
  },
] as const;

export type HomeIdea = (typeof homeIdeas)[number];
export type HomeIdeaId = HomeIdea["id"];
type HomeScreenshotIdeaId = Extract<HomeIdea, { kind: "build" }>["id"];

// The assets/home-idea-screenshots-v1 tag retains this immutable landing-site asset revision.
const screenshotBase =
  "https://raw.githubusercontent.com/pufflyai/prompt-studio/0ed498bdcc/clients/landing-page/public/images/home-ideas";

export const homeIdeaScreenshotUrl = (idea: HomeScreenshotIdeaId, mode: "light" | "dark") =>
  `${screenshotBase}/${idea}-${mode}.png`;
