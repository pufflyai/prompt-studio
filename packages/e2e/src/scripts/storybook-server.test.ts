import { describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { getSharedStorybookBaseUrl, startSharedStorybooks } from "./storybook-server";

describe("shared Storybook servers", () => {
  test("starts each package once and tears every server down", async () => {
    const env: NodeJS.ProcessEnv = {};
    const started: string[] = [];
    const stopped: string[] = [];

    const stop = await startSharedStorybooks({
      env,
      start: async (probeStoryId, packageName) => {
        started.push(`${packageName}:${probeStoryId}`);
        return {
          baseUrl: `http://${packageName}.test`,
          storybook: packageName as unknown as ChildProcess,
        };
      },
      stop: async (storybook) => {
        stopped.push(storybook as unknown as string);
      },
    });

    expect(started).toEqual([
      "ui:patterns-editors-mermaid-renderer--default",
      "pstdio-dashboard:dashboard-sidenav--workspace-resource",
      "pstdio-workbench:pstdio-workbench-examples--dashboard-workbench",
    ]);
    expect(getSharedStorybookBaseUrl("ui", env)).toBe("http://ui.test");
    expect(getSharedStorybookBaseUrl("pstdio-dashboard", env)).toBe("http://pstdio-dashboard.test");
    expect(getSharedStorybookBaseUrl("pstdio-workbench", env)).toBe("http://pstdio-workbench.test");

    await stop();

    expect(stopped).toEqual(["ui", "pstdio-dashboard", "pstdio-workbench"]);
  });
});
