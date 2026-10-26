import { expect, test } from "bun:test";
import { getRuntimeCollections, getWriter } from "@/lib/sync/collections";
import { subscribeSessionData } from "./session-data-subscription";

test("selected session subscriptions coalesce relevant rows and follow changed workspace links", async () => {
  getWriter("workspace_sessions")!.truncateAndWrite([{ id: "link", session_id: "selected", workspace_id: "old" }]);
  let calls = 0;
  const dispose = subscribeSessionData("selected", () => calls++);
  getWriter("sessions")!.upsert({ id: "other" });
  getWriter("files")!.upsert({ id: "noise" });
  await Promise.resolve();
  expect(calls).toBe(0);
  getWriter("workspaces")!.upsert({ id: "old" });
  getWriter("workspace_sessions")!.upsert({ id: "link", session_id: "selected", workspace_id: "new" });
  getWriter("workspaces")!.upsert({ id: "new" });
  await Promise.resolve();
  expect(calls).toBe(1);
  getWriter("workspaces")!.upsert({ id: "old" });
  await Promise.resolve();
  expect(calls).toBe(1);
  getWriter("workspace_sessions")!.remove("link");
  await Promise.resolve();
  expect(calls).toBe(2);
  dispose();
});

test("session subscriptions follow links from their original runtime after switching", async () => {
  const config = Object.getOwnPropertyDescriptor(globalThis, "__PSTDIO_CONFIG__");
  const select = (name: string) => {
    Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
      configurable: true,
      value: { apiBaseUrl: `http://${name}.invalid` },
    });
    const owner = getRuntimeCollections();
    owner.getWriter("workspace_sessions")!.upsert({ id: "link", session_id: "selected", workspace_id: name });
    return owner;
  };
  const first = select("first");
  let calls = 0;
  const unsubscribe = subscribeSessionData("selected", () => calls++);
  const second = select("second");
  try {
    first.getWriter("workspace_sessions")!.upsert({ id: "link", session_id: "selected", workspace_id: "first" });
    await Promise.resolve();
    expect(calls).toBe(1);
    first.getWriter("workspaces")!.upsert({ id: "first" });
    await Promise.resolve();
    expect(calls).toBe(2);
    second.getWriter("workspaces")!.upsert({ id: "second" });
    await Promise.resolve();
    expect(calls).toBe(2);
  } finally {
    unsubscribe();
    await Promise.all([first.dispose(), second.dispose()]);
    if (config) Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", config);
    else Reflect.deleteProperty(globalThis, "__PSTDIO_CONFIG__");
  }
});
