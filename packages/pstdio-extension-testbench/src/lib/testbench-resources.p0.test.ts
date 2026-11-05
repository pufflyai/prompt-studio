import { expect, test } from "bun:test";
import { createBenchResources } from "./testbench-resources";

test("preview workspace resolution stays within the selected project", async () => {
  const resources = await createBenchResources({}, [], "selected-project", [
    { id: "workspace", workspace_shorthand: "WS-1" },
  ]);
  const workspace = { type: "workspace", id: "workspace", extensionId: "pstdio" };
  expect(await resources.resolveMany([{ ...workspace, projectId: "another-project" }])).toEqual([]);
  for (const ref of [workspace, { ...workspace, projectId: "selected-project" }]) {
    expect(await resources.resolveMany([ref])).toMatchObject([
      { resource: { ...workspace, projectId: "selected-project", label: "WS-1" } },
    ]);
  }
});

test("preview identities and newly allocated resources share the host lookup APIs", async () => {
  const identity = { id: "preview-ticket", kind: "ticket", shorthand: "BP-2", aliases: ["BP-1"] };
  const resources = await createBenchResources({ ticket: "BP" }, [identity]);
  const created = await resources.allocate({ kind: "ticket" });
  expect(created.shorthand).toBe("BP-3");
  expect(await resources.identity({ kind: "ticket", id: identity.id })).toEqual(identity);
  expect(await resources.identityMany({ kind: "ticket", ids: [created.id, identity.id, "missing"] })).toEqual([
    { ...created, kind: "ticket", aliases: [] },
    identity,
    null,
  ]);
  expect(await resources.findByShorthand({ kind: "ticket", shorthand: "BP-1" })).toEqual([identity]);
  expect(await resources.findByShorthand({ kind: "ticket", shorthand: created.shorthand })).toEqual([
    { ...created, kind: "ticket", aliases: [] },
  ]);
  expect(await resources.identity({ kind: "note", id: identity.id })).toBeNull();
  expect(await (await createBenchResources({ ticket: "BP" })).identity({ kind: "ticket", id: identity.id })).toBeNull();
});
