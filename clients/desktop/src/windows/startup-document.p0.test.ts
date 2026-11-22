import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { WebContents } from "electron";
import { LIFECYCLE_URL } from "./lifecycle-protocol";
import { createStartupDocument, waitForStartupDom } from "./startup-document";

const lifecycle = () => Object.assign(new EventEmitter(), { getURL: () => LIFECYCLE_URL });

test("only the lifecycle document becoming ready releases workbench startup", async () => {
  let url = "about:blank";
  const contents = Object.assign(lifecycle(), { getURL: () => url });
  const ready = waitForStartupDom(contents as unknown as WebContents, new AbortController().signal);
  let finished = false;
  void ready.then(() => {
    finished = true;
  });
  contents.emit("dom-ready");
  contents.emit("did-fail-load", {}, -2, "Image failed", "pstdio://lifecycle/image.png", false);
  await Promise.resolve();
  expect(finished).toBe(false);
  url = LIFECYCLE_URL;
  contents.emit("dom-ready");
  await ready;
  expect(finished).toBe(true);
  expect(contents.eventNames()).toEqual([]);
});

for (const ending of ["failed-load", "crashed", "destroyed"] as const)
  test(`startup ${ending} rejects its readiness wait and detaches every listener`, async () => {
    const contents = lifecycle();
    const result = waitForStartupDom(contents as unknown as WebContents, new AbortController().signal).then(
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
  await expect(previous.ready).rejects.toThrow("Main document failed");
  expect(previous.failed).toBe(true);
  await expect(previous.ready).rejects.toThrow("Main document failed");
  const pending = createStartupDocument(contents as unknown as WebContents);
  pending.close();
  await expect(pending.ready).rejects.toThrow("replaced");
  expect(contents.eventNames()).toEqual([]);
  const replacement = createStartupDocument(contents as unknown as WebContents);
  contents.emit("dom-ready");
  await replacement.ready;
  expect(replacement.failed).toBe(false);
  expect(contents.eventNames()).toEqual([]);
});
