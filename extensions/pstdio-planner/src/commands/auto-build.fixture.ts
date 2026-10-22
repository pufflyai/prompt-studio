import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createSessionResource, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { sessionQuery } from "./session-query.fixture";
export async function fixture(limit = 2) {
  const storage = createMemoryStorage();
  const settings: Record<string, unknown> = {
    "automation.maxInProgress": limit,
    "workflow.statuses": {
      completedStatusIds: ["done"],
      blockedStatusIds: ["blocked"],
      activeStatusIds: ["in-progress", "in-review"],
      mergeTargetStatusId: "done",
    },
  };
  let sequence = 0;
  const workspaceBases = new Map<string, string>();
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
      process: {
        run: async ({ command }: { command: string[] }) => {
          if (command.includes("--is-ancestor"))
            return {
              exitCode: command.at(-2) !== command.at(-1) && command.at(-2) !== "main-sha" ? 1 : 0,
              stdout: "",
              stderr: "",
            };
          const path = command[command.indexOf("-C") + 1];
          const attempt = path?.startsWith("/workspace/")
            ? await storage
                .collection<{ revisions: { headSha: string }[] }>("planner-attempts")
                .get(path.slice("/workspace/".length))
            : null;
          return {
            exitCode: 0,
            stdout: `${attempt?.revisions.at(-1)?.headSha ?? workspaceBases.get(path?.slice("/workspace/".length) ?? "") ?? "main-sha"}\n`,
            stderr: "",
          };
        },
      } as never,
      workspaces: {
        list: async () => [],
        get: async (id: string) => ({
          id,
          root_path: `/workspace/${id}`,
          execution_kind: "local",
          provider_capabilities_json: { diff: true },
        }),
        create: async (input: { params?: Record<string, unknown> }) => {
          sequence += 1;
          workspaceBases.set(`workspace-${sequence}`, String(input.params?.base ?? "main-sha"));
          return { id: `workspace-${sequence}`, workspace_shorthand: `WS-${sequence}` };
        },
      } as never,
      sessions: {
        query: sessionQuery(
          async () => [],
          async () => [],
        ),
        create: async () => ({ ...createSessionResource(), id: `session-${sequence}` }),
        get: async (id: string) => (id === "fixture-supervisor" ? null : createSessionResource()),
      } as never,
    },
  });
  await storage.set("auto-build", {
    revision: "test",
    enabled: true,
    eligible: {
      conjunction: "and",
      rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready", "in-progress"] }],
    },
    prompt: "Implement relevant tickets.",
  });
  await storage.set("auto-build-supervisor", { sessionId: "fixture-supervisor" });
  const ticket = (title: string, dependsOn: string[] = []) =>
    createTicketCommand.run(ctx, { title, statusId: "ready", dependsOn });
  return { ctx, storage, ticket };
}
