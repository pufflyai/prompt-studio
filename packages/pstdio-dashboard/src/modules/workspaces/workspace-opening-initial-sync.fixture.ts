import { strict as assert } from "node:assert";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { setupWorkspaceOpening } from "./workspace-related-openings.fixture";

const s = setupWorkspaceOpening(false);
const controller = new AbortController();
const cancelled = Promise.resolve(s.resolve(s.source, controller.signal));
controller.abort();
await assert.rejects(cancelled);
let settled = false;
const pending = Promise.resolve(s.resolve()).then((result) => {
  settled = true;
  return result;
});
await Promise.resolve();
await Promise.resolve();
assert.equal(settled, false);
getWriter("sessions")?.truncateAndWrite([{ id: "latest", project_id: "project", title: "Latest", archived: false }]);
getWriter("workspace_sessions")?.truncateAndWrite([{ id: "link", workspace_id: "workspace", session_id: "latest" }]);
markInitialCollectionsSyncComplete();
assert.deepEqual(
  (await pending)?.map((entry) => ({ type: entry.resource.type, region: entry.region })),
  [{ type: "session", region: "side" }],
);

console.log("Initial sync and cancellation passed");
