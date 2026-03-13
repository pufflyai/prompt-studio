import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";

export const command = "stream";
export const describe = "Tail live session output in the terminal";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID to stream" });

type StreamArgs = { id: string };

type SSEEvent = { event: string; data: string };

type Deps = {
  connectSSE: (url: string, onEvent: (event: SSEEvent) => void) => Promise<void>;
  log: (msg: string) => void;
};

const parseSSEEvent = (part: string) => {
  let event = "message";
  let data = "";

  for (const line of part.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice(7);
      continue;
    }

    if (line.startsWith("data: ")) {
      data = line.slice(6);
    }
  }

  if (!event || !data) return null;
  return { event, data };
};

const consumeSSEBuffer = (buffer: string) => {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  const events = parts.map((part) => parseSSEEvent(part)).filter((event): event is SSEEvent => event !== null);

  return { remainder, events };
};

const defaultConnectSSE = async (url: string, onEvent: (event: SSEEvent) => void) => {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Connection failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { remainder, events } = consumeSSEBuffer(buffer);
    buffer = remainder;

    for (const event of events) {
      onEvent(event);
    }
  }
};

const defaultDeps: Deps = {
  connectSSE: defaultConnectSSE,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<StreamArgs>) => {
    deps.log(`Streaming session ${argv.id}...`);

    const url = `${API_URL}/v1/sessions/${argv.id}/stream`;

    await deps.connectSSE(url, ({ event, data }) => {
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
