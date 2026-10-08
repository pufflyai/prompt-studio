import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppServerItems } from "./app-server-items";
import { recoverCodexMessages } from "./history-reconciliation";
import { snapshotCodexImage } from "./image-items";
import { itemToMessage } from "./items";
import { normalizeRollout } from "./rollout";
import type { CodexThreadItem } from "./types";

test("captures a native viewed image and keeps its bytes when the source file is gone", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-image-"));
  const path = join(root, "long question.png");
  const data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=";
  await writeFile(path, Buffer.from(data, "base64"));
  try {
    const items: CodexThreadItem[] = [];
    createAppServerItems((item) => items.push(item)).receive({
      method: "item/completed",
      params: { item: { id: "image-1", type: "imageView", path } },
    });
    expect(items).toHaveLength(1);
    const captured = await snapshotCodexImage(items[0], root);
    const known = itemToMessage(captured, "live")!;
    expect(known.parts[0]).toMatchObject({
      tool: "view_image",
      status: "completed",
      state: { input: { path }, output: [{ type: "image", source: path, src: `data:image/png;base64,${data}` }] },
    });
    await rm(path);
    const native = normalizeRollout(
      JSON.stringify({
        type: "event_msg",
        payload: { type: "item_completed", item: { type: "ImageView", id: "image-1", path } },
      }),
    );
    const result = recoverCodexMessages({ knownMessages: [known], nativeMessages: native });
    expect(result.kind).toBe("recovered");
    if (result.kind === "recovered") {
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].parts).toEqual(known.parts);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
