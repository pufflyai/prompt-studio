import { expect, test } from "bun:test";
import { createFrameAssetBridge, type FrameBootstrap, frameBootstrap } from "./assets";
import { type FrameRequest, frameProtocol } from "./protocol";

const answer = (requestId: string, reply: { bootstrap?: FrameBootstrap; error?: string }): FrameRequest => ({
  protocol: frameProtocol,
  nonce: "frame",
  type: "assets",
  requestId,
  ...reply,
});

test("a nested frame's code request goes to the host and resolves with its answer", async () => {
  const requests: { requestId: string; source: string }[] = [];
  const bridge = createFrameAssetBridge((request) => requests.push(request));
  const bootstrap: FrameBootstrap = { entry: "entry.js", scripts: {}, styles: [] };

  const loaded = frameBootstrap("src/button.canvas.tsx");
  const failed = frameBootstrap("src/missing.canvas.tsx");
  expect(requests.map((request) => request.source)).toEqual(["src/button.canvas.tsx", "src/missing.canvas.tsx"]);
  bridge.receive(answer(requests[0]!.requestId, { bootstrap }));
  bridge.receive(answer(requests[1]!.requestId, { error: "Missing preview source" }));

  expect(await loaded).toBe(bootstrap);
  await expect(failed).rejects.toThrow("Missing preview source");
  bridge.dispose();
});

test("closing the frame rejects open requests and stops serving new ones", async () => {
  const bridge = createFrameAssetBridge(() => {});
  const pending = frameBootstrap("src/button.canvas.tsx");
  bridge.dispose();
  await expect(pending).rejects.toThrow("Preview closed");
  await expect(frameBootstrap("src/button.canvas.tsx")).rejects.toThrow("unavailable");
});
