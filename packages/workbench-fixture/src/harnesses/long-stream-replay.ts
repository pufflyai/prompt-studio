import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";

// A prompt containing this marker makes the fake agent replay a long, tool-heavy
// conversation. Performance tests use it to measure streaming cost repeatably.
export const LONG_STREAM_PROMPT_TRIGGER = "__fake_long_stream__";

export interface LongStreamShape {
  turns: number;
  chunksPerTurn: number;
  chunkDelayMs: number;
}

// About six seconds of streaming: 240 updates, 30 tool results.
export const DEFAULT_LONG_STREAM: LongStreamShape = { turns: 30, chunksPerTurn: 8, chunkDelayMs: 25 };

const turnText = (turn: number) =>
  `Step ${turn + 1}. ${"I read the workspace files, compared them with the plan, and noted what changed. ".repeat(6)}`;

const toolOutput = (turn: number) =>
  Array.from({ length: 40 }, (_, line) => `src/module-${turn}/file-${line}.ts  ${(turn + 1) * (line + 7)} lines`).join(
    "\n",
  );

const wait = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

interface ReplayLongStreamInput {
  agentSessionId: string;
  startIndex: number;
  shape: LongStreamShape;
  signal: AbortSignal;
  push: (patch: JsonPatch) => void;
}

export const replayLongStream = async (input: ReplayLongStreamInput) => {
  const { agentSessionId, startIndex, shape, signal, push } = input;
  for (let turn = 0; turn < shape.turns; turn += 1) {
    const index = startIndex + turn;
    const text = turnText(turn);
    for (let chunk = 1; chunk <= shape.chunksPerTurn; chunk += 1) {
      if (signal.aborted) return;
      const last = chunk === shape.chunksPerTurn;
      const message = {
        id: `${agentSessionId}-msg-${index}`,
        role: "assistant",
        index,
        parts: [
          { type: "text" as const, text: text.slice(0, Math.ceil((text.length * chunk) / shape.chunksPerTurn)) },
          ...(last
            ? [
                {
                  type: "tool" as const,
                  tool: "bash",
                  callId: `${agentSessionId}-call-${turn}`,
                  actionType: "execute" as const,
                  status: "completed" as const,
                  state: { status: "completed", input: { command: `ls src/module-${turn}` }, output: toolOutput(turn) },
                },
              ]
            : []),
        ],
      } satisfies SessionMessage;
      push({ op: chunk === 1 ? "add" : "replace", path: `/messages/${index}`, value: message });
      await wait(shape.chunkDelayMs, signal);
    }
  }
};
