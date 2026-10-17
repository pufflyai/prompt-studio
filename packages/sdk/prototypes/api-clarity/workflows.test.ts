import { expect, test } from "bun:test";
import { designs } from "./contracts";
import { verifyDesign } from "./experiment";
import { createFixture } from "./fixture";
import { createCommandStream } from "./helpers";

for (const design of designs) {
  test(`${design} completes all fifteen author tasks`, async () => {
    expect(await verifyDesign(design)).toHaveLength(15);
  });
}

test("named file handles preserve roots, grants and missing-workspace failure", async () => {
  const fixture = await createFixture();
  const { files } = fixture.apis.revised;
  await files.local.writeText("draft.md", "Local");
  expect(await files.defaultWorkspace.exists("draft.md")).toBe(false);
  expect(() => files.shared("undeclared")).toThrow("mount_not_declared");
  await expect(files.local.writeText("../escape", "Bad")).rejects.toThrow("path_outside_root");
  // Check the fixture's runtime guard as well as the separate readonly type contract.
  await expect(fixture.roots.package.writeText("template.md", "Bad")).rejects.toThrow("package_read_only");
  fixture.unavailableWorkspace();
  await expect(files.currentWorkspace.writeText("draft.md", "Draft")).rejects.toThrow("current_workspace_unavailable");
  expect(await files.defaultWorkspace.exists("draft.md")).toBe(false);
});

test("session iterator reads the second page and supports stopping after one result", async () => {
  const fixture = await createFixture();
  const ids = [];
  for await (const session of fixture.apis.revised.sessions.iterate({ workspaceId: "workspace-1" }))
    ids.push(session.id);
  expect(ids).toHaveLength(63);
  expect(ids).toContain("session-62");
  expect(fixture.calls.filter((call) => call === "sessions.query")).toHaveLength(2);
  fixture.calls.length = 0;
  for await (const _session of fixture.apis.revised.sessions.iterate({ workspaceId: "workspace-1" })) break;
  expect(fixture.calls).toEqual(["sessions.query"]);
});

test("stream returns its completion, cancels before iteration and cancels on early return", async () => {
  const complete = createCommandStream();
  const chunks = [];
  for await (const chunk of complete) chunks.push(chunk);
  expect(chunks).toEqual(["first", "second"]);
  expect((await complete.outcome).status).toBe("success");
  const cancelled = createCommandStream();
  await cancelled.cancel();
  const cancelledOutcome = await cancelled.outcome;
  expect(!cancelledOutcome.ok && cancelledOutcome.code).toBe("cancelled");
  const stopped = createCommandStream();
  for await (const _chunk of stopped) break;
  expect((await stopped.outcome).status).toBe("rejected");
});

test("current browser notification selection and plain errors lose parity", async () => {
  const fixture = await createFixture();
  const { current } = fixture.apis;
  expect((await current.notify.resolve({ id: "other-1", dedupeKey: "review" })).map((item) => item.id)).toEqual([
    "other-1",
  ]);
  const browser = await current.browser.resolve({ id: "other-1", dedupeKey: "review" });
  expect("notifications" in browser && browser.notifications.map((item) => item.id)).toEqual(["review-1", "review-2"]);
  await expect(current.browser.resolve({ id: "review-1", status: "expired" })).rejects.toThrow(
    "expired_by_id_unsupported",
  );
  try {
    await current.browser.saveTicket();
    throw new Error("Expected rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("data");
    expect(error).not.toHaveProperty("outcome");
  }
});

test("session iterator can select live statuses rather than scanning unrelated history", async () => {
  const fixture = await createFixture();
  const ids = [];
  for await (const session of fixture.apis.revised.sessions.iterate({
    workspaceId: "workspace-1",
    status: ["in_progress"],
  }))
    ids.push(session.id);
  expect(ids).toEqual(["session-62"]);
});
