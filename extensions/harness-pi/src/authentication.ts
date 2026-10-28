import { fileURLToPath } from "node:url";
import type { HarnessAuthentication, HarnessAuthenticationChannel, HarnessContext } from "@pstdio/sdk/extensions";
import type { AccountWorkerInput, AccountWorkerMessage } from "./account-worker-protocol";
import { piBunCommand, resolvePiModule } from "./cli";
import { type PiProcessOptions, piRecords, startPiProcess } from "./process";

export const runPiAccountWorker = async (
  input: AccountWorkerInput,
  options: PiProcessOptions = {},
  channel?: HarnessAuthenticationChannel,
) => {
  const launcher = piBunCommand(fileURLToPath(new URL("./account-worker.ts", import.meta.url)));
  const module = resolvePiModule();
  const signals = [
    options.signal,
    channel?.signal,
    input.type === "status" ? AbortSignal.timeout(10_000) : undefined,
  ].filter((signal): signal is AbortSignal => Boolean(signal));
  const signal = AbortSignal.any(signals);
  const worker = startPiProcess([], {
    ...options,
    command: launcher.command,
    env: { ...options.env, ...launcher.env },
    signal,
  });
  const failure = Promise.withResolvers<never>();
  let finished = false;
  const pump = async () => {
    worker.child.stdin.write(`${JSON.stringify({ action: input, module })}\n`);
    for await (const value of piRecords(worker.child.stdout)) {
      const message = value as unknown as AccountWorkerMessage;
      if (message.type === "state") return message.value;
      if (message.type === "completed") return;
      if (message.type === "error") throw new Error(message.message);
      if (message.type !== "prompt" || !channel) throw new Error("Pi returned an invalid account response.");
      const { prompt, id } = message;
      if (prompt.type !== "input" && prompt.type !== "select") {
        await channel.emit(prompt);
        continue;
      }
      // Keep reading: a browser callback may complete while manual code input is still pending.
      void channel
        .request(prompt)
        .then((value) => {
          if (!finished && !signal.aborted) worker.child.stdin.write(`${JSON.stringify({ id, value })}\n`);
        })
        .catch((cause) => {
          if (!finished) failure.reject(cause);
        });
    }
    await worker.exited;
    signal.throwIfAborted();
    throw new Error("Pi closed before the account action completed.");
  };
  try {
    return await Promise.race([pump(), failure.promise]);
  } finally {
    finished = true;
    await worker.stop();
  }
};

export const getPiAuthentication = async (
  ctx: HarnessContext,
  input?: { model?: string },
  options: PiProcessOptions = {},
) => {
  try {
    const result = await runPiAccountWorker({ type: "status", model: input?.model }, options);
    if (result) return result;
  } catch {
    ctx.logger.warn("Pi account discovery failed.");
  }
  return { status: "unknown", providers: [] } satisfies HarnessAuthentication;
};
