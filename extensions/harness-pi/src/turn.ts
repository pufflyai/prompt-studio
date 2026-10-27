import type { HarnessExit, HarnessSession, HarnessStartInput } from "@pstdio/sdk/extensions";
import { normalizePiMessages, type PiMessage } from "./messages";
import { type PiProcessOptions, piRecords, startPiProcess } from "./process";

export const startPiTurn = (input: HarnessStartInput & { agentSessionId?: string }, options: PiProcessOptions = {}) => {
  const args = ["--mode", "json"];
  if (input.agentSessionId) args.push("--session", input.agentSessionId);
  if (input.model) args.push("--model", input.model);
  if (typeof input.params?.thinking === "string") args.push("--thinking", input.params.thinking);
  for (const attachment of input.attachments ?? []) args.push(`@${attachment.localPath}`);
  const process = startPiProcess(args, { ...options, cwd: input.cwd, signal: input.signal });
  const prefix = [...input.events.getMessages()];
  const native: PiMessage[] = [];
  let current = -1;
  let stopped = false;
  let sessionId: string | undefined;
  const { promise: ready, resolve: resolveReady, reject: rejectReady } = Promise.withResolvers<string>();
  const publish = () => {
    const messages = normalizePiMessages(native, prefix.length);
    const user = messages.find((message) => message.role === "user");
    if (user)
      user.parts = [
        { type: "text", text: input.prompt },
        ...(input.attachments ?? []).map((file) => ({
          type: "file" as const,
          fileId: file.fileId,
          filename: file.fileName,
          mediaType: file.mimeType ?? undefined,
          size: file.sizeBytes,
          url: file.url,
        })),
      ];
    input.events.push({ op: "replace", path: "/messages", value: [...prefix, ...messages] });
  };
  const accept = (record: Record<string, unknown>) => {
    if (record.type === "session" && typeof record.id === "string") {
      sessionId = record.id;
      resolveReady(record.id);
    }
    if (record.type === "message_start") {
      current = native.length;
      native.push(record.message as PiMessage);
      publish();
    } else if ((record.type === "message_update" || record.type === "message_end") && record.message) {
      native[current] = record.message as PiMessage;
      publish();
    }
  };
  const done = (async () => {
    try {
      process.child.stdin.end(input.prompt);
      for await (const record of piRecords(process.child.stdout)) {
        accept(record);
      }
      const exit = await process.exited;
      if (!sessionId) throw new Error(`Pi exited before starting a session. ${process.diagnostics()}`);
      if (stopped || input.signal?.aborted) return { status: "cancelled" } satisfies HarnessExit;
      const failed = native.filter((message) => message.role === "assistant").at(-1)?.stopReason === "error";
      return { status: exit.code === 0 && !failed ? "completed" : "failed" } satisfies HarnessExit;
    } catch (error) {
      rejectReady(error);
      await process.stop();
      if (!sessionId) throw error;
      return { status: stopped || input.signal?.aborted ? "cancelled" : "failed" } satisfies HarnessExit;
    }
  })();
  void done.catch(() => {});
  const stop = async () => {
    stopped = true;
    await process.stop();
    await done.catch(() => {});
  };
  const session = ready.then(
    (agentSessionId) =>
      ({ agentSessionId, done, stop, pid: process.child.pid, timeoutStrategy: "provider" }) satisfies HarnessSession,
  );
  return { session, done, stop };
};
