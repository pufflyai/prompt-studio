import { expect, test } from "bun:test";
import { createLogProgress } from "./log-progress";

test("history progress stays unknown until the index arrives and counts each log once while catching up", () => {
  const progress = createLogProgress();
  expect(progress.status(new Set())).toMatchObject({ downloaded: false, download: { completed: 0, total: null } });
  progress.receive(new Set(["own"]), ["a", "b"], new Set(["b"]));
  expect(progress.status(new Set(["own"]))).toMatchObject({
    downloaded: false,
    pendingItems: 1,
    download: { completed: 2, total: 3 },
  });
  progress.received("b");
  expect(progress.status(new Set())).toMatchObject({
    downloaded: true,
    pendingItems: 0,
    download: { completed: 3, total: 3 },
  });
  progress.invalidate();
  expect(progress.status(new Set()).download.total).toBeNull();
});
