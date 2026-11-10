import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { DESKTOP_CHANNELS } from "../desktop-api";
import { LIFECYCLE_URL } from "./lifecycle-protocol";
import { createStartupDocument, waitForStartupPaint } from "./startup-paint";

const lifecycle = () => Object.assign(new EventEmitter(), { mainFrame: { url: LIFECYCLE_URL } });

test("only the owned lifecycle main frame can release startup painting", async () => {
  const contents = lifecycle();
  const paint = waitForStartupPaint(contents as unknown as WebContents, new AbortController().signal);
  let finished = false;
  void paint.then(() => {
    finished = true;
  });
  contents.emit("ipc-message", { senderFrame: contents.mainFrame }, "another-channel");
  contents.emit("ipc-message", { senderFrame: { url: LIFECYCLE_URL } }, DESKTOP_CHANNELS.startupPainted);
  contents.mainFrame.url = "http://127.0.0.1/workbench";
  contents.emit("ipc-message", { senderFrame: contents.mainFrame }, DESKTOP_CHANNELS.startupPainted);
  contents.emit("did-fail-load", {}, -2, "Image failed", "pstdio://lifecycle/image.png", false);
  await Promise.resolve();
  expect(finished).toBe(false);
  contents.mainFrame.url = LIFECYCLE_URL;
  contents.emit("ipc-message", { senderFrame: contents.mainFrame }, DESKTOP_CHANNELS.startupPainted);
  await paint;
  expect(finished).toBe(true);
  expect(contents.eventNames()).toEqual([]);
});

for (const ending of ["failed-load", "crashed", "destroyed"] as const)
  test(`startup ${ending} rejects its paint wait and detaches every listener`, async () => {
    const contents = lifecycle();
    const result = waitForStartupPaint(contents as unknown as WebContents, new AbortController().signal).then(
      () => null,
      (error: unknown) => error,
    );
    if (ending === "failed-load") contents.emit("did-fail-load", {}, -2, "Main document failed", LIFECYCLE_URL, true);
    else contents.emit(ending === "crashed" ? "render-process-gone" : "destroyed");
    expect(await result).toBeInstanceOf(Error);
    expect(contents.eventNames()).toEqual([]);
  });

test("a failed navigation stays failed for later joiners and replacing its receipt releases old listeners", async () => {
  const contents = lifecycle();
  const previous = createStartupDocument(contents as unknown as WebContents);
  contents.emit("did-fail-load", {}, -2, "Main document failed", LIFECYCLE_URL, true);
  await expect(previous.painted).rejects.toThrow("Main document failed");
  expect(previous.failed).toBe(true);
  await expect(previous.painted).rejects.toThrow("Main document failed");
  const pending = createStartupDocument(contents as unknown as WebContents);
  pending.close();
  await expect(pending.painted).rejects.toThrow("replaced");
  expect(contents.eventNames()).toEqual([]);
  const replacement = createStartupDocument(contents as unknown as WebContents);
  contents.emit("ipc-message", { senderFrame: contents.mainFrame }, DESKTOP_CHANNELS.startupPainted);
  await replacement.painted;
  expect(replacement.failed).toBe(false);
  expect(contents.eventNames()).toEqual([]);
});
