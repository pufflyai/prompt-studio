import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { runTicketsQuery } from "./query";

test("workspace badges follow stable ticket IDs even when an anchor has a shared old number", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const first = await createTicketCommand.run(ctx, { title: "First" });
  const second = await createTicketCommand.run(ctx, { title: "Second" });
  const identities = [
    { id: first.id, kind: "ticket", shorthand: "T-1", aliases: [] },
    { id: second.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] },
  ];
  ctx.resources.identity = async ({ id }) => identities.find((entry) => entry.id === id) ?? null;
  const result = await runTicketsQuery({
    storage,
    resources: ctx.resources,
    projectId: ctx.projectId,
    workspaces: [
      {
        id: "workspace",
        workspace_shorthand: "T-1_A1",
        anchors_json: [{ type: "ticket", id: second.id, shorthand: "T-1" }],
      },
    ],
  });
  expect(result.rows.find(({ id }) => id === first.id)?.attributes.workspace).toBe("");
  expect(result.rows.find(({ id }) => id === second.id)?.attributes.workspace).toBe("workspace");
});

test("a workspace branch number resolves through core aliases when no ticket is anchored", async () => {
  const { workspaceTicketIds } = await import("./workspace-ticket-link");
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Renumbered" });
  ctx.resources.findByShorthand = async ({ shorthand }) =>
    shorthand === "T-1" ? [{ id: ticket.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] }] : [];
  expect(await workspaceTicketIds(ctx, { id: "workspace", branch: "workspace/T-1_A1" })).toEqual([ticket.id]);
});
