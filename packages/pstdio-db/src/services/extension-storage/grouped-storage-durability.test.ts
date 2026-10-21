import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "../../db/connection.pglite";
import { createDocumentStorageDBService } from "./document-storage";

test("a reported local group survives abrupt process termination before database close", async () => {
  const root = await mkdtemp(join(tmpdir(), "grouped-crash-"));
  const path = join(root, "database");
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "grouped-storage-crash.fixture.ts"), path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const errors = new Response(child.stderr).text();
  let reopened: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    const reader = child.stdout.getReader();
    let output = "";
    const decoder = new TextDecoder();
    while (!output.includes("\n")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error(`Writer exited before a local receipt: ${await errors}`);
      output += decoder.decode(chunk.value, { stream: true });
    }
    reader.releaseLock();
    expect(JSON.parse(output.trim()).status).toBe("saved-locally");
    child.kill("SIGKILL");
    await child.exited;
    reopened = await createDb({ path });
    const storage = createDocumentStorageDBService(reopened.db).open({
      owner: { workbenchId: "crash-workbench", extensionId: "example.notes" },
    });
    expect((await storage.records.read("one")).value).toBe("first");
    expect((await storage.records.read("two")).value).toBe("second");
    expect((await storage.records.outcome("crash-group"))?.status).toBe("saved-locally");
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    await child.exited;
    await errors;
    await reopened?.close();
    await rm(root, { recursive: true, force: true });
  }
});
