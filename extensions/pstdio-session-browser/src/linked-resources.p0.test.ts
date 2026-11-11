import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { listSessionLinks } from "./linked-resources";

test("sessions show incoming and outgoing ticket links once and hide empty groups", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const session = { type: "session", extensionId: "pstdio", id: "session", projectId: ctx.projectId };
  const ticket = {
    type: "ticket",
    extensionId: "pstdio.pstdio-planner",
    id: "ticket",
    projectId: ctx.projectId,
    label: "Implement navigation",
  };
  ctx.resources.resolveMany = async (refs) =>
    refs.map((resource) => ({
      resource,
      target: { kind: "page", page: { kind: "page", extensionId: resource.extensionId, id: "detail" }, resource },
    }));
  const read = () => listSessionLinks(ctx, { renderer: { rendererId: "links", resource: session } });
  expect(await read()).toEqual([]);
  await ctx.resources.addAnchors(ticket, [session]);
  expect((await read()).map((section) => section.id)).toEqual(["tickets"]);
  expect((await read())[0].nodes[0].target).toMatchObject({ resource: ticket });
  await ctx.resources.addAnchors(session, [ticket]);
  expect((await read())[0].nodes).toHaveLength(1);
  await ctx.resources.removeAnchors(ticket, [session]);
  expect((await read())[0].nodes).toHaveLength(1);
  await ctx.resources.removeAnchors(session, [ticket]);
  expect(await read()).toEqual([]);
});
