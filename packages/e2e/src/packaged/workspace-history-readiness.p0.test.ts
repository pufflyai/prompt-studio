import { expect, test } from "bun:test";
import { waitForForeignWorkspaceHistory } from "./workspace-history-readiness.fixture";

test("workspace history waits when the session arrives before its shared link", async () => {
  let linkDelivered = false;
  let ready = false;
  const reading = waitForForeignWorkspaceHistory({
    sessionId: "session",
    deviceId: "first-device",
    readSessions: async (workspaceId) => ({
      items: !workspaceId || linkDelivered ? [{ id: "session" }] : [],
    }),
    readWorkspaces: async () => ({ items: [{ id: "workspace", device: { id: "first-device" } }] }),
  }).then((workspace) => {
    ready = true;
    return workspace;
  });
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(ready).toBe(false);
  } finally {
    linkDelivered = true;
    await reading;
  }
  expect(await reading).toMatchObject({ id: "workspace" });
  expect(ready).toBe(true);
});
