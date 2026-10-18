import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createSessionResource, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { sessionQuery } from "./session-query.fixture";
export async function fixture(limit = 2) {
  const storage = createMemoryStorage();
  const settings: Record<string, unknown> = { "automation.maxInProgress": limit };
  let sequence = 0;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      automation: { list: async () => [], enqueue: async () => ({}) } as never,
      process: {
        run: async ({ command }) => ({
          exitCode:
            command.includes("--is-ancestor") && command.at(-2) !== command.at(-1) && command.at(-2) !== "main-sha"
              ? 1
              : 0,
          stdout: "main-sha\n",
          stderr: "",
        }),
      },
      settings: {
        get: async (key) => settings[key] ?? "",
        all: async () => ({ ...settings }),
        set: async (key, value) => {
          settings[key] = value;
        },
      },
      workspaces: {
        get: async (id: string) => ({
          id,
          root_path: `/repo/${id}`,
          execution_kind: "local",
          provider_capabilities_json: { diff: true },
        }),
        list: async () => [],
        create: async () => {
          sequence += 1;
          return { id: `workspace-${sequence}`, workspace_shorthand: `WS-${sequence}` };
        },
      } as never,
      sessions: {
        query: sessionQuery(
          async () => [],
          async () => [],
        ),
        create: async () => ({ ...createSessionResource(), id: `session-${sequence}` }),
        get: async () => createSessionResource(),
      } as never,
    },
  });
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    prompt: "Implement relevant tickets.",
    ignore: {
      conjunction: "and",
      rules: [{ attributeId: "status", condition: "is-any-of", value: ["backlog", "done"] }],
    },
  });
  const ticket = (title: string, dependsOn: string[] = []) =>
    createTicketCommand.run(ctx, { title, statusId: "ready", dependsOn });
  return { ctx, storage, ticket };
}
