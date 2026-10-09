import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { createAppServerOperation } from "./app-server-operation";
import { snapshotCodexImage } from "./image-items";
import { itemToMessage } from "./items";
import { nativeItemMessage, recoverNativeHistory } from "./native-history";
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
    const known = itemToMessage(captured, "codex-image-turn")!;
    expect(known.parts[0]).toMatchObject({
      tool: "view_image",
      status: "completed",
      state: { input: { path }, output: [{ type: "image", source: path, src: `data:image/png;base64,${data}` }] },
    });
    await rm(path);
    const native = [nativeItemMessage({ type: "imageView", id: "image-1", path }, "image-turn")!];
    const result = recoverNativeHistory({ knownMessages: [known], nativeMessages: native });
    expect(result.kind).toBe("recovered");
    if (result.kind === "recovered") {
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].parts).toEqual(known.parts);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finishes a native turn only after its viewed image has been captured", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-live-image-"));
  try {
    await writeFile(join(root, "preview.png"), Buffer.from("aGVsbG8=", "base64"));
    const messages: SessionMessage[] = [];
    const operation = createAppServerOperation(
      {
        prompt: "View the image",
        cwd: root,
        events: {
          getMessages: () => messages,
          push: (patch) => {
            messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
          },
        },
      },
      {
        transcriptPath: () => null,
        write: () => {},
        onFinish: () => {},
        onProtocolError: (error) => {
          throw error;
        },
      },
    );
    operation.startDelivery();
    operation.acknowledge("image-turn");
    operation.receive({
      method: "item/completed",
      params: { item: { type: "imageView", id: "image-1", path: "preview.png" } },
    });
    operation.receive({ method: "turn/completed", params: { turn: { id: "image-turn", status: "completed" } } });
    expect(await operation.done).toEqual({ status: "completed" });
    expect(messages.flatMap((message) => message.parts).find((part) => part.type === "tool")).toMatchObject({
      tool: "view_image",
      state: { output: [{ source: "preview.png", src: "data:image/png;base64,aGVsbG8=" }] },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
