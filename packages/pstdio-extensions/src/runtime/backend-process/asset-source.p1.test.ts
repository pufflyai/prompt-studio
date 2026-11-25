import { expect, test } from "bun:test";
import { exportAssetStageInput, importAssetStageInput } from "./asset-source";

test("aborting a command stops its remaining asset reads", async () => {
  const controller = new AbortController();
  const wire = exportAssetStageInput(
    { operationId: "asset", source: new Blob(["part".repeat(64 * 1024)]) },
    controller.signal,
  );
  const reader = importAssetStageInput(wire).source.stream().getReader();
  try {
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(first.value?.byteLength).toBeLessThan(wire.source.size);
    const reason = new Error("Command cancelled");
    controller.abort(reason);
    await expect(reader.read()).rejects.toBe(reason);
  } finally {
    reader.releaseLock();
  }
});
