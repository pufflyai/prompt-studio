import { expect, test } from "bun:test";
import { createBenchResources } from "./testbench-resources";

test("preview identities and newly allocated resources share the host lookup APIs", async () => {
  const identity = { id: "preview-ticket", kind: "ticket", shorthand: "BP-2", aliases: ["BP-1"] };
  const resources = createBenchResources({ ticket: "BP" }, [identity]);
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
  expect(await createBenchResources({ ticket: "BP" }).identity({ kind: "ticket", id: identity.id })).toBeNull();
});
