import { stripVTControlCharacters } from "node:util";
import type { ConversationMessage, LogChunk } from "@pstdio/pocketcoder-sdk";
import type { ExtensionConnectionsApi } from "@pstdio/sdk/extensions";
import { deployedItems, getDeployed, listDeployed } from "./deployed-controller";
import { createLogTail } from "./log-tail";
import { machinePath } from "./machines";

type Connections = Pick<ExtensionConnectionsApi, "request">;
type Message = Omit<ConversationMessage, "seq">;
type OutputMessage = Pick<Message, "role" | "occurred_at" | "parts">;
const outputLimit = 64 * 1024;

function tail(text: string) {
  const plain = stripVTControlCharacters(text);
  if (plain.length <= outputLimit) return plain;
  return `[Earlier output omitted]\n${plain.slice(-outputLimit)}`;
}

export function formatTestOutput(messages: OutputMessage[]) {
  const sections = messages.flatMap(({ role, occurred_at, parts }) => {
    if (role === "user") return [];
    return (parts ?? []).flatMap((part) =>
      part.type === "tool" && part.output_text
        ? [`[${occurred_at}] ${part.name} (${part.status})\n${part.output_text}`]
        : [],
    );
  });
  return tail(sections.join("\n\n"));
}

export async function readTestOutput(connections: Connections, machineId: string) {
  const path = `${machinePath(machineId)}/conversation`;
  const { turns } = await getDeployed<{ turns: { messages: Message[] }[] }>(connections, `${path}/open`);
  const stored = await listDeployed<ConversationMessage>(connections, path);
  // A turn may finish between these reads. Use the stored output if it already committed.
  const committed = new Set(stored.map((message) => message.message_id));
  const live = turns.flatMap(({ messages }) => messages).filter((message) => !committed.has(message.message_id));
  return formatTestOutput([...stored, ...live]);
}

export async function readWorkspaceLogs(connections: Connections, machineId: string) {
  const output = createLogTail(outputLimit);
  for await (const chunk of deployedItems<LogChunk>(connections, `${machinePath(machineId)}/logs`))
    output.append(chunk.content);
  return output.read();
}
