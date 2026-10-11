import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createSessionResource, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
export async function fixture(limit = 2) {
  const storage = createMemoryStorage();
  const settings: Record<string, unknown> = { "automation.maxInProgress": limit };
  let sequence = 0;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      automation: { list: async () => [], enqueue: async () => ({}) } as never,
      settings: {
        get: async (key) => settings[key] ?? "",
        all: async () => ({ ...settings }),
        set: async (key, value) => {
          settings[key] = value;
        },
      },
      workspaces: {
        list: async () => [],
        create: async () => {
          sequence += 1;
          return { id: `workspace-${sequence}`, workspace_shorthand: `WS-${sequence}` };
        },
      } as never,
      sessions: {
        list: async () => [],
        create: async () => ({ ...createSessionResource(), id: `session-${sequence}` }),
        get: async () => createSessionResource(),
      } as never,
    },
  });
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
  });
  const ticket = (title: string, dependsOn: string[] = []) =>
    createTicketCommand.run(ctx, { title, statusId: "ready", dependsOn });
  return { ctx, storage, ticket };
}
