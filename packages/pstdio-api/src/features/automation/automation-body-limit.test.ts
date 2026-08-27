import { afterEach, describe, expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";

let closeApp: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeApp?.();
  closeApp = undefined;
});

describe("automation request body limit", () => {
  test("rejects an oversized public request before machine authentication", async () => {
    const created = await createTestApp({ host: { kind: "standalone", token: "runtime-token" } });
    closeApp = created.close;

    const response = await created.app.request("/v1/projects/project-1/automation-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commandId: "example.command", input: { payload: "x".repeat(70 * 1024) } }),
    });

    expect(response.status).toBe(413);
  });
});
