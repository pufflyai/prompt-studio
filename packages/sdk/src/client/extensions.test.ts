import { expect, test } from "bun:test";
import { createExtensionClient } from "./extensions";
import type { RequestFn, RequestOptions } from "./request";

test("encodes extension instance IDs in reset-layout paths", async () => {
  const calls: Array<{ path: string; method: string | undefined }> = [];
  const request: RequestFn = async <T>(path: string, options?: RequestOptions) => {
    calls.push({ path, method: options?.method });
    return undefined as T;
  };
  const client = createExtensionClient(request);

  await client.resetLayout("project-1", "extension/instance ?one", { modeId: "project" });

  expect(calls).toEqual([
    {
      path: "/v1/projects/project-1/extensions/extension%2Finstance%20%3Fone/reset-layout",
      method: "POST",
    },
  ]);
});
