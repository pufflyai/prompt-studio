// These production consumers exercise the current public SDK and UI artifacts.
export const uiFixtureExtensions = [
  "github",
  "git-workspaces",
  "pstdio-session-browser",
  "pstdio-artifacts",
  "pstdio-cloud",
  "pstdio-home",
  "pstdio-skill-browser",
  "pstdio-performance",
  "pstdio-planner",
  "pstdio-workspaces",
  "pstdio-terminal",
];
export const fixtureExtensionsForRunner = (runner: string) =>
  ["app", "packaged-cli", "packaged-browser"].includes(runner) ? uiFixtureExtensions : [];
