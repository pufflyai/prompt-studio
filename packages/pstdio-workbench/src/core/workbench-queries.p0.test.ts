import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createWorkbench } from "./workbench-core";
import { getWorkbenchQueries } from "./workbench-queries";

test("standalone query authority retires with its core while a supplied runtime authority remains available", async () => {
  const standalone = createWorkbench();
  const owned = getWorkbenchQueries(standalone);
  await owned.query({ id: "data", read: () => "loaded" }).read();
  await standalone.dispose();
  expect(owned.isDisposed()).toBe(true);
  expect(() => getWorkbenchQueries(standalone)).toThrow("closed");

  const runtime = createScopedQueryClient({ runtimeId: "runtime", extensionId: "pstdio" });
  const a = createWorkbench({ queries: runtime });
  const b = createWorkbench({ queries: runtime });
  expect(getWorkbenchQueries(a)).toBe(getWorkbenchQueries(b));
  await a.dispose();
  expect(runtime.isDisposed()).toBe(false);
  expect(
    await getWorkbenchQueries(b)
      .query({ id: "live", read: () => "other project" })
      .read(),
  ).toBe("other project");
  await b.dispose();
  runtime.dispose();
});
