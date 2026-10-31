// The workspace script is the execution boundary for these test runners.
export const testRunnerScripts: Record<string, string> = {
  component: "test:browser",
  app: "test:ui",
  vite: "test:vite-terminal",
  "packaged-cli": "test:packaged:cli",
  "packaged-browser": "test:packaged:browser",
};
