import { expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
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
