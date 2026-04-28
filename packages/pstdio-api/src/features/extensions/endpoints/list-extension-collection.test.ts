import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";

let tempRoots: string[] = [];
let closeFns: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const close of closeFns) await close();
  closeFns = [];

  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
  tempRoots = [];
});

describe("GET /v1/projects/:projectId/extensions/:extensionId/collections/:collection", () => {
  test("returns project-scoped extension collection rows", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-collection-api-"));
    tempRoots.push(tempRoot);

    const { app, close, deps } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });
    closeFns.push(close);

    const project = await deps.projectService.create({ name: "Extension Storage" });
    await deps.extensionStorageService
      .collection({
        projectId: project.id,
        extensionId: "project.extension-lab",
        collection: "tickets",
      })
      .put("PS-1", { shorthand: "PS-1", title: "Stored by extension" });

    const response = await app.request(
      `/v1/projects/${project.id}/extensions/project.extension-lab/collections/tickets`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        expect.objectContaining({
          extension_id: "project.extension-lab",
          collection: "tickets",
          item_id: "PS-1",
          value_json: { shorthand: "PS-1", title: "Stored by extension" },
        }),
      ],
    });
  });
});
