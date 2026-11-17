import { expect, test } from "bun:test";
import { persistWebviewPreference } from "./webview-preference-writes";

test("accepted presentation choices drain in order after the originating guest leaves, with independent owners", async () => {
  const runtime = {};
  const held = Promise.withResolvers<void>();
  const writes: string[] = [];
  const first = persistWebviewPreference(runtime, ["project-a", "revision", "artifact"], async () => {
    writes.push("a:first");
    await held.promise;
  });
  const last = persistWebviewPreference(runtime, ["project-a", "revision", "artifact"], async () => {
    writes.push("a:last");
  });
  await persistWebviewPreference(runtime, ["project-b", "revision", "artifact"], async () => {
    writes.push("b");
  });
  // No guest callback is needed to admit or drain last; its persistence owner already has it.
  expect(writes).toEqual(["a:first", "b"]);
  held.resolve();
  await Promise.all([first, last]);
  expect(writes).toEqual(["a:first", "b", "a:last"]);
});
test("an earlier failed preference cannot discard a later accepted choice", async () => {
  const runtime = {};
  const first = persistWebviewPreference(runtime, "selection", async () => {
    throw new Error("failed first");
  });
  let saved = "";
  const last = persistWebviewPreference(runtime, "selection", async () => {
    saved = "last";
  });
  await expect(first).rejects.toThrow("failed first");
  await last;
  expect(saved).toBe("last");
});
