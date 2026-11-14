// These production consumers exercise the current public SDK and UI artifacts.
export const uiFixtureExtensions = [
  "pstdio-session-browser",
  "pstdio-artifacts",
  "pstdio-cloud",
  "pstdio-home",
  "pstdio-skill-browser",
  "pstdio-performance",
  "pstdio-planner",
  "pstdio-workspaces",
];
export const fixtureExtensionsForRunner = (runner: string) =>
  ["app", "packaged-cli", "packaged-browser"].includes(runner) ? uiFixtureExtensions : [];
