import { expect, test } from "bun:test";
import type { StorageLogPage } from "pstdio-sync-contracts";
import { followLogPages } from "./log-follow";

test("log-follow cancellation releases its subscription while a remote read is still pending", async () => {
  let release!: (page: StorageLogPage) => void;
  const blocked = new Promise<StorageLogPage>((resolve) => {
    release = resolve;
  });
  const controller = new AbortController();
  let stopped = 0;
  let done = false;
  const iterator = followLogPages({
    read: () => blocked,
    watch: () => () => {
      stopped++;
    },
    signal: controller.signal,
  });
  const next = iterator.next().then((value) => {
    done = value.done === true;
  });
  try {
    controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(done).toBe(true);
    expect(stopped).toBe(1);
  } finally {
    release({ entries: [], cursor: "finished", more: false });
    await next;
  }
});
