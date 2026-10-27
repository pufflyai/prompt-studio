import { createInterface } from "node:readline";
import { createAgentSessionServices } from "@mariozechner/pi-coding-agent";
import type { HarnessAuthenticationChannel } from "@pstdio/sdk/extensions";
import { authenticatePiAccount, getPiAccountState } from "./account-state";
import type { AccountWorkerInput, AccountWorkerMessage } from "./account-worker-protocol";

// Native extensions may log while registering providers. Stdout belongs to this private protocol.
console.log = (...args: unknown[]) => console.error(...args);
const controller = new AbortController();
const initial = Promise.withResolvers<AccountWorkerInput>();
const pending = new Map<number, ReturnType<typeof Promise.withResolvers<string>>>();
let sequence = 0;
let started = false;
const write = (message: AccountWorkerMessage) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reader = createInterface({ input: process.stdin });
reader.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (!started) {
      started = true;
      initial.resolve(message);
      return;
    }
    const question = pending.get(message.id);
    pending.delete(message.id);
    question?.resolve(message.value);
  } catch {
    initial.reject(new Error("Invalid account request."));
    controller.abort();
  }
});
controller.signal.addEventListener(
  "abort",
  () => {
    for (const reply of pending.values()) reply.reject(controller.signal.reason);
    pending.clear();
  },
  { once: true },
);
reader.once("close", () => controller.abort());
const channel: HarnessAuthenticationChannel = {
  signal: controller.signal,
  emit: async (prompt) => {
    controller.signal.throwIfAborted();
    write({ type: "prompt", prompt });
  },
  request: async (prompt) => {
    controller.signal.throwIfAborted();
    const id = ++sequence;
    const reply = Promise.withResolvers<string>();
    pending.set(id, reply);
    write({ type: "prompt", id, prompt });
    return reply.promise;
  },
};
const main = async () => {
  const request = await initial.promise;
  const services = await createAgentSessionServices({
    cwd: process.cwd(),
    resourceLoaderOptions: { noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true },
  });
  if (request.type === "status") {
    write({ type: "state", value: getPiAccountState(services, request.model) });
    return;
  }
  await authenticatePiAccount(services, request.input, channel);
  write({ type: "completed" });
};
void main()
  .catch((cause: unknown) =>
    write({ type: "error", message: cause instanceof Error ? cause.message : "Pi account action failed." }),
  )
  .finally(() => {
    controller.abort();
    reader.close();
  });
