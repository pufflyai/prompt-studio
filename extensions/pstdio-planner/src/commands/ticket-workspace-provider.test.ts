import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { createWorkspaceCommand } from "./ticket-actions";

test("creates a ticket workspace with the chosen provider and accepts pending cloud provisioning", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Cloud notes" } }));
  const creations: unknown[] = [];
  const workspace = {
    id: "cloud-1",
    provider_id: "cloud.environment",
    provider_state: "provisioning" as const,
    execution_kind: "remote" as const,
    root_path: null,
  };
  const result = await createWorkspaceCommand.run(
    ...makeCommandArgs({
      storage,
      params: {
        ticket: ticket.id,
        provider_id: "cloud.environment",
        params: { image: "notes", source: "cloud://notes" },
      },
      overrides: {
        workspaces: {
          listProviders: async () => [{ id: "cloud.environment", label: "Cloud", params: {} }],
          create: async (input) => {
            creations.push(input);
            return workspace;
          },
        },
      },
    }),
  );
  expect(result.workspace).toEqual(workspace);
  expect(creations).toEqual([
    expect.objectContaining({
      provider_id: "cloud.environment",
      params: { image: "notes", source: "cloud://notes" },
      shorthand_base: ticket.shorthand,
      anchors: [expect.objectContaining({ type: "ticket", id: ticket.id, role: "primary" })],
    }),
  ]);
});
