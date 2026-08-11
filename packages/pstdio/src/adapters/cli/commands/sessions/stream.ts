import { createClient } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import { resolveApiUrl } from "@/features/api-url";

export const command = "stream";
export const describe = "Tail live session output in the terminal";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID to stream" });

export type StreamArgs = { id: string };

type SSEEvent = { event: string; data: string };

type Deps = {
  streamSession: (sessionId: string, onEvent: (event: SSEEvent) => void) => Promise<void>;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  streamSession: (sessionId, onEvent) => createClient({ baseUrl: resolveApiUrl() }).sessions.stream(sessionId, onEvent),
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<StreamArgs>) => {
    deps.log(`Streaming session ${argv.id}...`);

    await deps.streamSession(argv.id, ({ event, data }) => {
      if (event === "ready") return;

      if (event === "patch") {
        const patch = JSON.parse(data) as { op: string; path: string; value?: unknown };
        if (patch.value && typeof patch.value === "object" && "text" in (patch.value as Record<string, unknown>)) {
          deps.log((patch.value as { text: string }).text);
        }
        return;
      }

      if (event === "approval_request") {
        const req = JSON.parse(data) as { id: string; toolName: string };
        deps.log(
          `\n⏸ Awaiting approval — use 'pstdio sessions approve --id ${argv.id} --approval-id ${req.id}' to continue.`,
        );
        deps.log(`  Tool: ${req.toolName}`);
        return;
      }

      if (event === "end") {
        const { status } = JSON.parse(data) as { status: string };
        deps.log(`\nSession ${argv.id} ${status}.`);
      }
    });
  };

export const handler = createHandler();
