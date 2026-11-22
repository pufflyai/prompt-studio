import type { ConversationMessage, LogChunk } from "@pstdio/pocketcoder-sdk";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { deployedItems, getDeployed } from "./deployed-controller";
import { createLogTail } from "./log-tail";
import { machinePath } from "./machines";

type Connections = Pick<ExtensionConnectionsApi, "request">;
type Message = Omit<ConversationMessage, "seq">;
type OutputMessage = Pick<Message, "role" | "occurred_at" | "parts">;
const outputLimit = 64 * 1024;

function createTestOutput() {
  const output = createLogTail(outputLimit);
  let hasSection = false;
  return {
    append({ role, occurred_at, parts }: OutputMessage) {
      if (role === "user") return;
      for (const part of parts ?? []) {
        if (part.type !== "tool" || !part.output_text) continue;
        if (hasSection) output.append("\n\n");
        output.append(`[${occurred_at}] ${part.name} (${part.status})\n`);
        output.append(part.output_text);
        hasSection = true;
      }
    },
    read: output.read,
  };
}

export async function readTestOutput(connections: Connections, machineId: string) {
  const path = `${machinePath(machineId)}/conversation`;
  const { turns } = await getDeployed<{ turns: { messages: Message[] }[] }>(connections, `${path}/open`);
  const output = createTestOutput();
  const liveIds = new Set<string>();
  for (const turn of turns) for (const message of turn.messages) liveIds.add(message.message_id);
  // A turn may finish between these reads. Use the stored output if it already committed.
  for await (const message of deployedItems<ConversationMessage>(connections, path)) {
    liveIds.delete(message.message_id);
    output.append(message);
  }
  for (const turn of turns)
    for (const message of turn.messages) if (liveIds.has(message.message_id)) output.append(message);
  return output.read();
}

export async function readWorkspaceLogs(connections: Connections, machineId: string) {
  const output = createLogTail(outputLimit);
  for await (const chunk of deployedItems<LogChunk>(connections, `${machinePath(machineId)}/logs`))
    output.append(chunk.content);
  return output.read();
}
