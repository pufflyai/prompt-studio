import { expect, test } from "bun:test";
import { getDashboardQueryClient } from "./query-client";
import { createRuntimeCollections } from "./sync/collections";

test("file query results and cleanup belong to their runtime connection", async () => {
  const first = createRuntimeCollections();
  const second = createRuntimeCollections();
  const a = getDashboardQueryClient(first);
  const b = getDashboardQueryClient(second);
  const key = ["api-file-url", "/v1/files/same/content"];
  const firstBlob = URL.createObjectURL(new Blob(["first"]));
  const secondBlob = URL.createObjectURL(new Blob(["second"]));
  a.setQueryData(key, firstBlob);
  expect(b.getQueryData(key)).toBeUndefined();
  b.setQueryData(key, secondBlob);
  await first.dispose();
  expect(a.getQueryData(key)).toBeUndefined();
  expect(b.getQueryData<string>(key)).toBe(secondBlob);
  expect(await (await fetch(secondBlob)).text()).toBe("second");
  let revoked = false;
  try {
    await fetch(firstBlob);
  } catch {
    revoked = true;
  }
  expect(revoked).toBe(true);
  await second.dispose();
});
