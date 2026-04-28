import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";

let tempRoot: string;
let handle: Awaited<ReturnType<typeof createApp>>;

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-file-content-"));
  handle = await createApp({ dbPath: ":memory:", storagePath: join(tempRoot, "storage"), filesRoot: "" });
});

afterEach(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/files/:fileId/content", () => {
  test("returns generic file content", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "File Content Project" }),
    });
    const project = (await projectRes.json()) as { id: string };
    const file = await handle.deps.fileService.upload({
      project_id: project.id,
      file_name: "notes.txt",
      file_kind: "planner-ticket-file",
      data: Buffer.from("hello file", "utf8"),
      mime_type: "text/plain",
    });

    const res = await handle.app.request(`/v1/files/${file.id}/content`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("hello file");
  });
});
