import { expect, test } from "bun:test";
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
