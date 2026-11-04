import { expect, test } from "bun:test";
import { deviceCommandInputLimit } from "pstdio-sync-contracts";
import { createTestApp } from "../../test-utils/create-test-app";

test("remote device commands reject missing and non-JSON bodies before dispatch", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Command validation" });
    const path = `/v1/account/projects/${project.id}/devices/other/commands`;
    for (const contentType of [undefined, "text/plain", "application/json"]) {
      const response = await app.app.request(path, {
        method: "POST",
        headers: contentType ? { "content-type": contentType } : {},
        ...(contentType ? { body: JSON.stringify({}) } : {}),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false });
    }
  } finally {
    await app.close();
  }
});

test("a valid streamed command reaches dispatch after its bytes are checked", async () => {
  const app = await createTestApp();
  try {
    const response = await app.app.request("/v1/account/projects/project/devices/other/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"type":"session.interrupt","id":"session"}'));
          controller.close();
        },
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "This project is not connected to Cloud" });
  } finally {
    await app.close();
  }
});

test.each([
  undefined,
  "1",
])("rejects excessive actual command bytes before parsing with content length %s", async (length) => {
  const app = await createTestApp();
  let cancelled = false;
  let chunks = 0;
  const chunk = new Uint8Array(1024 * 1024).fill(32);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunks++ < deviceCommandInputLimit / chunk.byteLength + 5) controller.enqueue(chunk);
      else {
        controller.enqueue(new TextEncoder().encode("{}"));
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  try {
    const response = await app.app.request("/v1/account/projects/project/devices/other/commands", {
      method: "POST",
      headers: { "content-type": "application/json", ...(length ? { "content-length": length } : {}) },
      body,
    });
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(chunks).toBeLessThanOrEqual(deviceCommandInputLimit / chunk.byteLength + 2);
  } finally {
    await app.close();
  }
});
