import { expect, test } from "bun:test";
import { PstdioApiError, PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { createLocalProjectDeletion } from "./local-project-deletion";

test("local deletion previews only its project and uses an exact read after a lost response", async () => {
  const queries = createScopedQueryClient({ runtimeId: "fixture", accountId: "local", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const rejected = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const writes: string[] = [];
  const reads: string[] = [];
  const accepted: string[] = [];
  let removed = false;
  const service = createLocalProjectDeletion(operations, {
    async remove(id) {
      writes.push(id);
      entered.resolve();
      await rejected.promise;
    },
    async read(id) {
      reads.push(id);
      if (removed) throw new PstdioApiError("Project not found", 404);
      return { id };
    },
    accept: (id) => void accepted.push(id),
  });
  try {
    const original = service.remove("project-a", "Studio");
    expect(service.hidden("project-a")).toBe(true);
    expect(service.hidden("project-b")).toBe(false);
    await entered.promise;
    queries.clearScope({ projectId: "project-a" });
    rejected.reject(new PstdioConnectionError(new Error("Response lost")));
    await expect(original).rejects.toThrow("Could not connect");
    expect(service.hidden("project-a")).toBe(false);
    await expect(service.remove("project-a", "Studio")).rejects.toThrow("already has a pending deletion");

    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({ status: "unknown", draft: { projectId: "project-a", name: "Studio" } });
    await operations.check(recovery.id);
    expect(accepted).toEqual([]);
    removed = true;
    await operations.check(recovery.id);
    expect(writes).toEqual(["project-a"]);
    expect(reads).toEqual(["project-a", "project-a"]);
    expect(accepted).toEqual(["project-a"]);
    expect(operations.getSnapshot().recovery).toEqual([]);
  } finally {
    queries.dispose();
  }
});
