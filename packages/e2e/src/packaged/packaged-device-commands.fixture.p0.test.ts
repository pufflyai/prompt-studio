import { expect, test } from "bun:test";
import { syncPath } from "pstdio-sync-contracts";
import { createDeviceCommandPeer } from "./packaged-device-commands.fixture";

test("device command peer preserves scoped relay access when forwarding durable history", async () => {
  const peer = createDeviceCommandPeer(undefined);
  try {
    const projectId = "history / project";
    const login = await fetch(`${peer.origin}/v1/device-login`, {
      method: "POST",
      body: JSON.stringify({ deviceId: "reader", name: "Reader" }),
    });
    expect(login.ok).toBe(true);
    const credential = (await login.json()).token;
    const issued = await fetch(`${peer.origin}/v1/environment-access`, {
      method: "POST",
      headers: { authorization: `Bearer ${credential}` },
      body: JSON.stringify({ workbenchId: projectId }),
    });
    expect(issued.ok).toBe(true);
    const access = (await issued.json()).token;
    const read = (projectId: string, spaceOwner: string | null) =>
      fetch(
        `${peer.origin}${syncPath({ kind: "document", projectId, spaceOwner, documentId: "history_0123456789", operation: "read" })}`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${access}`, "pstdio-sync-protocol": "1" },
          body: JSON.stringify({ after: 0 }),
        },
      );
    expect((await read(projectId, "owner")).status).toBe(200);
    expect((await read("another-project", "owner")).status).toBe(403);
    expect((await read(projectId, "another-account")).status).toBe(403);
  } finally {
    await peer.close();
  }
});
