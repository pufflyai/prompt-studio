import { expect, test } from "bun:test";
import type { PstdioClient } from "@pstdio/sdk/client";
import { createAccountCapability } from "./account-capability";

test("webview account calls without a project id use the webview's project", async () => {
  const requested: string[] = [];
  const account = {
    projectSyncStatus: async (projectId: string) => {
      requested.push(`status:${projectId}`);
      return { state: "synced" as const, offlineReady: true };
    },
    stopProjectSync: async (projectId: string) => {
      requested.push(`local:${projectId}`);
      return { ok: true };
    },
  };
  const capability = createAccountCapability("project-1", { account } as unknown as Pick<PstdioClient, "account">);

  expect(await capability.projectSyncStatus()).toEqual({ state: "synced", offlineReady: true });
  await capability.stopProjectSync();
  await capability.stopProjectSync("project-2");

  expect(requested).toEqual(["status:project-1", "local:project-1", "local:project-2"]);
});
