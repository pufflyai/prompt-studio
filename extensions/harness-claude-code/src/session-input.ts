import type { Writable } from "node:stream";
import type {
  HarnessAttachment,
  HarnessSteeringInput,
  HarnessSteeringResult,
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

// One owner coordinates user input and EOF. An unacknowledged write may still be queued inside Claude.
export const createSessionInput = (stdin: Writable) => {
  const pending = new Map<string, PendingInput>();
  let runningBackgroundTasks = 0;
  let closed = false;
  const acceptsInput = () => !closed && stdin.writable && !stdin.destroyed;
  const uncertain = (reason: string) => {
    closed = true;
    for (const entry of pending.values()) entry.settle({ status: "uncertain", reason });
  };
  stdin.on("error", (error) => uncertain(error.message));
  stdin.on("close", () => uncertain("Claude input pipe closed before acknowledgment."));

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
      if (parsed.type === "system" && parsed.subtype === "background_tasks_changed") {
        runningBackgroundTasks = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
      }
      if (parsed.type === "result" && runningBackgroundTasks === 0 && pending.size === 0 && acceptsInput()) {
        closed = true;
        stdin.end();
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
