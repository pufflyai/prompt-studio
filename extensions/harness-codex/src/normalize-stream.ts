import type { HarnessEventSink, SessionMessage } from "@pstdio/sdk/extensions";
import { errorMessage, itemToMessage, usageMessage } from "./items";
import type { CodexThreadEvent } from "./types";
import { parseThreadEvent } from "./types";

type PipelineOptions = {
  initialMessages?: SessionMessage[];
  indexOffset?: number;
};

// Codex items carry stable ids, so item.updated/item.completed replace the
// message produced by the matching item.started instead of appending.
export const createCodexStreamPipeline = (sink: HarnessEventSink, options: PipelineOptions = {}) => {
  const offset = options.indexOffset ?? 0;
  const itemIndex = new Map<string, number>();
  let length = 0;
  let turn = 0;
  let lastError: string | undefined;

  const toPath = (idx: number) => `/messages/${offset + idx}`;

  const add = (message: SessionMessage) => {
    sink.push({ op: "add", path: toPath(length), value: message });
    length += 1;
  };

  for (const message of options.initialMessages ?? []) {
    add(message);
  }

  const handleEvent = (event: CodexThreadEvent) => {
    if (event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed") {
      const message = itemToMessage(event.item, `codex-${turn}`);
      if (!message) return;

      const existing = itemIndex.get(message.id);
      if (existing !== undefined) {
        sink.push({ op: "replace", path: toPath(existing), value: message });
        return;
      }

      itemIndex.set(message.id, length);
      add(message);
      return;
    }

    if (event.type === "turn.completed") {
      add(usageMessage(event.usage, `codex-usage-${turn}`));
      turn += 1;
      return;
    }

    // Codex reports a failure as an error event followed by turn.failed with
    // the same message, so identical consecutive errors collapse into one.
    if (event.type === "turn.failed") {
      if (event.error?.message !== lastError) {
        add(errorMessage(event.error?.message, `codex-turn-failed-${turn}`));
      }
      lastError = undefined;
      turn += 1;
      return;
    }

    if (event.type === "error") {
      add(errorMessage(event.message, `codex-error-${length}`));
      lastError = event.message;
    }
  };

  const handleLine = (line: string) => {
    const event = parseThreadEvent(line);
    if (event) handleEvent(event);
  };

  return { handleEvent, handleLine };
};
