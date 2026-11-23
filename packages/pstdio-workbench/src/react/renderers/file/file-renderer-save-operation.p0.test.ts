import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "../../../core/registries/mutations/operations";
import { saveWithDocumentRecovery } from "./file-renderer-save-operation";

test("a quiet file save survives a lost response without replaying the write", async () => {
  const scope = { runtimeId: "workbench", extensionId: "notes", projectId: "project" };
  const queries = createScopedQueryClient(scope);
  const operations = getWorkbenchOperations(queries);
  const response = Promise.withResolvers<never>();
  let saved = { content: "Original text", filePath: "notes.md" };
  const accepted: (typeof saved)[] = [];
  let writes = 0;
  const input = {
    scope,
    queries,
    loadKey: "notes.md",
    title: "Save notes.md",
    value: "Keep this exact draft",
    filePath: "notes.md",
    async write() {
      writes++;
      return response.promise;
    },
    async read() {
      return { content: saved };
    },
    accept(receipt: { content?: { content?: string; filePath?: string } }) {
      if (receipt.content?.content !== undefined && receipt.content.filePath !== undefined) {
        accepted.push({ content: receipt.content.content, filePath: receipt.content.filePath });
      }
    },
  };
  try {
    const request = saveWithDocumentRecovery(input);
    expect(operations.getSnapshot().recovery).toEqual([]);
    await Promise.resolve();
    response.reject(new PstdioConnectionError(new Error("Write response lost")));
    await expect(request).rejects.toMatchObject({ name: "UnconfirmedFileSaveError" });
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({ status: "unknown", draft: input.value, canCheck: true });
    await expect(saveWithDocumentRecovery({ ...input, value: "Newer text" })).rejects.toMatchObject({
      name: "UnconfirmedFileSaveError",
    });
    saved = { filePath: "other.md", content: input.value };
    await operations.check(recovery.id);
    expect(accepted).toEqual([]);
    saved = { filePath: "notes.md", content: input.value };
    await operations.check(recovery.id);
    expect(accepted).toEqual([saved]);
    expect(operations.getSnapshot().recovery).toEqual([]);
    expect(writes).toBe(1);
  } finally {
    queries.dispose();
  }
});
