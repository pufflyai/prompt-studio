import { expect, test } from "bun:test";
import { watchJobExit } from "./windows-granted-process";

test("a fresh job accounting check can confirm cleanup after a failed query", async () => {
  const failure = new Error("fixture accounting query failed");
  const failed = Promise.withResolvers<unknown>();
  let queries = 0;
  let closed = 0;
  const job = {
    hasProcesses() {
      if (++queries === 1) throw failure;
      return false;
    },
    close() {
      closed++;
    },
  };
  const tracking = watchJobExit(job, Promise.resolve(), failed.resolve);
  let verified = false;
  void tracking.treeExited.then(() => {
    verified = true;
  });
  expect(await failed.promise).toBe(failure);
  expect(verified).toBe(false);
  expect(closed).toBe(0);

  await tracking.check();
  await tracking.treeExited;
  expect(queries).toBe(2);
  expect(verified).toBe(true);
  expect(closed).toBe(1);
});
