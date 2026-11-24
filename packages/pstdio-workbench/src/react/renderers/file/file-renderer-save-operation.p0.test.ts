import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "../../../core/registries/mutations/operations";
import { createFileEditController } from "./file-renderer-edit-state";
import { afterFileSaveSettles, saveWithDocumentRecovery } from "./file-renderer-save-operation";

test("a quiet file save survives a lost response without replaying the write", async () => {
  const scope = { runtimeId: "workbench", extensionId: "notes", projectId: "project" };
  const queries = createScopedQueryClient(scope);
  const operations = getWorkbenchOperations(queries);
  const response = Promise.withResolvers<never>();
  let saved = { content: "Original text", filePath: "notes.md" };
  const accepted: (typeof saved)[] = [];
  const writes: string[] = [];
  let updateDraft: ((draft: unknown) => void) | undefined;
  const input = {
    scope,
    queries,
    loadKey: "notes.md",
    title: "Save notes.md",
    value: "Keep this exact draft",
    filePath: "notes.md",
    retainDraft: (update: (draft: unknown) => void) => {
      updateDraft = update;
    },
    async write() {
      writes.push("Keep this exact draft");
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
    const detached = { submitted: input.value, draft: "Typed before the editor closed" };
    updateDraft?.(detached);
    response.reject(new PstdioConnectionError(new Error("Write response lost")));
    await expect(request).rejects.toMatchObject({ name: "UnconfirmedFileSaveError" });
    const recovery = operations.getSnapshot().recovery[0]!;
    expect(recovery).toMatchObject({ status: "unknown", draft: detached, canCheck: true });
    let stopWatching: (() => void) | undefined;
    const peer = createFileEditController({
      binding: { rendererId: "notes", instanceId: "peer" },
      load() {},
      saveMode: "manual",
      debounceMs: 0,
      onStateChange(state) {
        if (state.saveUnconfirmed && !stopWatching)
          stopWatching = afterFileSaveSettles(queries, input.loadKey, () => {
            const confirmed = accepted[0];
            if (confirmed) peer.confirmSave(confirmed.content);
          });
      },
      async save(value) {
        await saveWithDocumentRecovery({
          ...input,
          value,
          async write() {
            writes.push(value);
            return {};
          },
        });
        return undefined;
      },
    });
    peer.setBaseline("Original text");
    peer.handleChange("Newer text");
    peer.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(peer.getState()).toMatchObject({ dirty: true, saveUnconfirmed: true });
    expect(writes).toEqual([input.value]);
    saved = { filePath: "other.md", content: input.value };
    await operations.check(recovery.id);
    expect(accepted).toEqual([]);
    saved = { filePath: "notes.md", content: input.value };
    await operations.check(recovery.id);
    expect(accepted).toEqual([saved]);
    expect(operations.getSnapshot().recovery.map(({ draft, status }) => ({ draft, status }))).toEqual([
      { draft: detached.draft, status: "rejected" },
      { draft: "Newer text", status: "rejected" },
    ]);
    expect(peer.getState()).toEqual({ dirty: true, saving: false });
    expect(peer.getDraft()).toBe("Newer text");
    peer.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writes).toEqual([input.value, "Newer text"]);
    expect(peer.getState()).toEqual({ dirty: false, saving: false });
    expect(operations.getSnapshot().recovery.map(({ draft }) => draft)).toEqual([detached.draft]);
  } finally {
    queries.dispose();
  }
});
