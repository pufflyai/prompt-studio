// Shared by the queue's Playwright config and the local review coverage report.
export const browserSmokeTestMatch = ["**/startup.p1.spec.ts"];
export const selectBrowserSmokeFiles = (files: string[]) =>
  files.filter(
    (file) =>
      file.startsWith("packages/e2e/src/ui/") &&
      browserSmokeTestMatch.some((pattern) => new Bun.Glob(pattern).match(file)),
  );
