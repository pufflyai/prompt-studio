import type { createEventStore } from "../../services/event-store";
import type { JsonPatch } from "../../types";
import type { OpencodeSessionMessage, OpencodeSessionMessageInfo } from "./opencode-types";

export const userMessage = (text: string): OpencodeSessionMessage => ({
  role: "user",
  content: [{ type: "text", text }],
});

const assistantMessage = (
  parts: { type: string; tool?: string; text?: string; state?: { status?: string; input?: unknown } }[],
  time?: { created?: number; completed?: number },
  error?: OpencodeSessionMessageInfo["error"],
): OpencodeSessionMessage => ({
  info: { role: "assistant", time: { created: time?.created ?? Date.now(), ...time }, error },
  parts,
});

export const completedAssistant = (text: string, error?: OpencodeSessionMessageInfo["error"]): OpencodeSessionMessage =>
  assistantMessage([{ type: "text", text }], { created: Date.now(), completed: Date.now() }, error);

export const inFlightAssistant = (text: string): OpencodeSessionMessage =>
  assistantMessage([{ type: "text", text }], { created: Date.now() });

export const questionAssistant = (): OpencodeSessionMessage =>
  assistantMessage(
    [
      { type: "text", text: "Let me ask you something." },
      {
        type: "tool",
        tool: "question",
        state: {
          status: "completed",
          input: { questions: [{ id: "q1", question: "Which?", options: ["A", "B"] }] },
        },
      },
    ],
    { created: Date.now() },
  );

export const createMessageTimeline = () => {
  let messages: OpencodeSessionMessage[] = [];
  const loader = async () => [...messages];
  const set = (next: OpencodeSessionMessage[]) => {
    messages = next;
  };
  return { loader, set };
};

export const collectPatches = (eventStore: ReturnType<typeof createEventStore>) => {
  const patches: JsonPatch[] = [];
  const sub = eventStore.subscribe();
  const reader = (async () => {
    for await (const patch of sub) {
      patches.push(patch);
    }
  })();
  return { patches, done: reader };
};

export const tick = () => new Promise((resolve) => setTimeout(resolve, 1_100));
