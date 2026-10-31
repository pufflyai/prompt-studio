import { expect, test } from "bun:test";
import { createFrameAssetBridge } from "./asset-bridge";
import { frameProtocol } from "./protocol";

test("nested frames receive only their requested assets and disposal rejects unfinished work", async () => {
  const requests: { type: "assets"; requestId: string; source: string }[] = [];
  const bridge = createFrameAssetBridge((request) => requests.push(request));
  const loaded = bridge.load("button");
  const bootstrap = { scripts: { "button.js": new Blob(["button"]) }, styles: [], entry: "button.js" };
  bridge.receive({
    protocol: frameProtocol,
    nonce: "test",
    type: "assets",
    requestId: requests[0].requestId,
    bootstrap,
  });
  expect(await loaded).toBe(bootstrap);
  const unfinished = bridge.load("editor").catch((error) => error);
  bridge.dispose();
  expect(await unfinished).toBeInstanceOf(Error);
  expect((await unfinished).message).toBe("Preview closed");
  bridge.receive({
    protocol: frameProtocol,
    nonce: "test",
    type: "assets",
    requestId: requests[1].requestId,
    bootstrap,
  });
});
