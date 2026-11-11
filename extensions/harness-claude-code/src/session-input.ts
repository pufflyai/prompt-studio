import type { Writable } from "node:stream";
import type {
  HarnessAttachment,
  HarnessBackgroundTask,
  HarnessSteeringInput,
  HarnessSteeringResult,
  HarnessTurnChannel,
  SessionMessage,
} from "@pstdio/sdk/extensions";
import { claudePrompt } from "./literal-prompt";

export const promptWithAttachmentManifest = (prompt: string, attachments: HarnessAttachment[] = []) => {
  if (attachments.length === 0) return prompt;
  return [
    prompt,
    "",
    "<session-attachments>",
    ...attachments.map(
      (attachment) =>
        `- name=${JSON.stringify(attachment.fileName)} path=${JSON.stringify(attachment.localPath)} mime=${JSON.stringify(attachment.mimeType)} size=${attachment.sizeBytes}`,
    ),
    "</session-attachments>",
  ].join("\n");
};

export const userMessageFor = (
  prompt: string,
  attachments: HarnessAttachment[] = [],
  id: string = crypto.randomUUID(),
): SessionMessage => ({
  id,
  role: "user",
  createdAt: Date.now(),
  parts: [
    { type: "text", text: prompt },
    ...attachments.map((attachment) => ({
      type: "file" as const,
      fileId: attachment.fileId,
      filename: attachment.fileName,
      mediaType: attachment.mimeType ?? undefined,
      size: attachment.sizeBytes,
      url: attachment.url,
    })),
  ],
});

interface PendingInput {
  message: SessionMessage;
  settle: (result: HarnessSteeringResult) => void;
}

const backgroundTask = (task: Record<string, unknown>): HarnessBackgroundTask => ({
  id: String(task.task_id),
  description: typeof task.description === "string" ? task.description : String(task.task_type ?? "Background task"),
});

// Events that only appear once Claude works on a turn, as opposed to task progress between turns.
// A background subagent's messages carry its parent tool use and do not start a main turn.
const startsTurn = (parsed: Record<string, unknown>) =>
  (parsed.type === "system" && parsed.subtype === "init") ||
  (parsed.type === "assistant" && parsed.parent_tool_use_id == null) ||
  (parsed.type === "user" && parsed.isReplay === true);

// One owner coordinates user input and EOF. An unacknowledged write may still be queued inside Claude.
// A turn that ends while background tasks run keeps stdin open, and the host hears it is idle.
export const createSessionInput = (stdin: Writable, turns?: HarnessTurnChannel) => {
  const pending = new Map<string, PendingInput>();
  let backgroundTasks: HarnessBackgroundTask[] = [];
  let idle = false;
  let closed = false;
  const acceptsInput = () => !closed && stdin.writable && !stdin.destroyed;
  const uncertain = (reason: string) => {
    closed = true;
    for (const entry of pending.values()) entry.settle({ status: "uncertain", reason });
  };
  stdin.on("error", (error) => uncertain(error.message));
  stdin.on("close", () => uncertain("Claude input pipe closed before acknowledgment."));

  const observeTurn = (parsed: Record<string, unknown>) => {
    if (parsed.type === "system" && parsed.subtype === "background_tasks_changed") {
      backgroundTasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(backgroundTask) : [];
      // With no task left, Claude wakes for the last notification and that turn ends the run.
      if (idle && backgroundTasks.length > 0) turns?.idle({ backgroundTasks });
    }
    if (idle && startsTurn(parsed)) {
      idle = false;
      turns?.busy();
    }
  };

  const send = (message: SessionMessage, prompt: string) => {
    stdin.write(`${JSON.stringify({ type: "user", uuid: message.id, message: { role: "user", content: prompt } })}\n`);
  };

  return {
    send,
    acceptsInput,
    processExited: () => {
      closed = true;
    },
    stop: () => uncertain("Claude run stopped before acknowledgment."),
    close: () => {
      uncertain("Claude stream ended before acknowledgment.");
      pending.clear();
    },
    observe(parsed: Record<string, unknown>) {
      observeTurn(parsed);
      if (parsed.type === "result" && pending.size === 0 && acceptsInput()) {
        if (backgroundTasks.length === 0) {
          closed = true;
          stdin.end();
        } else {
          idle = true;
          turns?.idle({ backgroundTasks });
        }
      }
      if (parsed.type === "user" && parsed.isReplay === true && typeof parsed.uuid === "string") {
        return pending.get(parsed.uuid)?.message;
      }
    },
    accepted(id: string) {
      const entry = pending.get(id);
      pending.delete(id);
      entry?.settle({ status: "accepted" });
    },
    async steer(input: HarnessSteeringInput) {
      input.signal?.throwIfAborted();
      if (!acceptsInput()) return { status: "rejected", reason: "Claude run is no longer accepting input." } as const;
      const message = userMessageFor(input.prompt, input.attachments, input.deliveryId);
      return new Promise<HarnessSteeringResult>((resolve) => {
        const abort = () => settle({ status: "uncertain", reason: "Delivery cancelled after a possible send." });
        const settle = (result: HarnessSteeringResult) => {
          input.signal?.removeEventListener("abort", abort);
          resolve(result);
        };
        pending.set(message.id, { message, settle });
        input.signal?.addEventListener("abort", abort, { once: true });
        try {
          send(message, promptWithAttachmentManifest(claudePrompt(input.prompt), input.attachments));
        } catch (error) {
          uncertain(String(error));
        }
      });
    },
  };
};
