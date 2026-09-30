import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { openSessionStream } from "../../../test-utils/session-stream";

test("a missing session stream closes with the unknown end event", async () => {
  const handle = await createTestApp();
  try {
    const response = await openSessionStream(handle.app, "missing-session");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("event: ready");
    expect(body).toContain("event: end");
    expect(body).toContain('"status":"unknown"');
  } finally {
    await handle.close();
  }
});
