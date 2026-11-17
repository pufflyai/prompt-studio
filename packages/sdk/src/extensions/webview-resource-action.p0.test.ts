import { expect, test } from "bun:test";
import type { GuestHost } from "./guest-host";
import { registerWebviewResourceAction } from "./webview-resource-action";

const setup = () => {
  const calls: Record<string, unknown>[] = [];
  let listener: (payload: unknown) => void = () => {};
  const host: GuestHost = {
    onEvent: (_scope, callback) => {
      listener = callback;
      return () => {
        listener = () => {};
      };
    },
    call: async (_method, ...args) => {
      calls.push(args[0] as Record<string, unknown>);
      return undefined as never;
    },
  };
  return { host, calls, emit: (payload: unknown) => listener(payload) };
};
const resource = { type: "artifact", id: "one", projectId: "project", extensionId: "artifacts" };
test("resource action errors are returned to the exact native invocation", async () => {
  const f = setup();
  const action = registerWebviewResourceAction(f.host, { resource, label: "Export HTML" }, async () => {
    throw new Error("Unavailable");
  });
  await action.ready;
  const registrationId = f.calls[0]!.registrationId;
  f.emit({ type: "execute", registrationId, requestId: "request" });
  await Bun.sleep(0);
  expect(f.calls.at(-1)).toMatchObject({ operation: "complete", requestId: "request", error: "Unavailable" });
  await action.dispose();
});
test("dispose aborts in-flight guest work before it can download and removes its lease", async () => {
  const f = setup();
  let finish!: () => void;
  const wait = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let downloads = 0;
  const action = registerWebviewResourceAction(f.host, { resource, label: "Export HTML" }, async (signal) => {
    await wait;
    signal.throwIfAborted();
    downloads++;
  });
  await action.ready;
  f.emit({ type: "execute", registrationId: f.calls[0]!.registrationId, requestId: "request" });
  await Promise.resolve();
  await action.dispose();
  finish();
  await Bun.sleep(0);
  expect(downloads).toBe(0);
  expect(f.calls.at(-1)).toMatchObject({ operation: "unregister", registrationId: f.calls[0]!.registrationId });
  expect(f.calls.some((call) => call.operation === "complete")).toBe(false);
});

test("a resource choice callback receives its selected value and remains awaited", async () => {
  const f = setup();
  let selected: string | undefined;
  const action = registerWebviewResourceAction(
    f.host,
    { resource, label: "Versions", choices: [{ id: "older", label: "First", selected: true }] },
    async (_signal, value) => {
      selected = value;
    },
  );
  await action.ready;
  expect(f.calls[0]).toMatchObject({ choices: [{ id: "older", label: "First", selected: true }] });
  f.emit({ type: "execute", registrationId: f.calls[0]!.registrationId, requestId: "choice", choiceId: "older" });
  await Bun.sleep(0);
  expect(selected).toBe("older");
  expect(f.calls.at(-1)).toMatchObject({ operation: "complete", requestId: "choice" });
  await action.dispose();
});

test("refreshing a choice group keeps its accepted selection alive", async () => {
  const f = setup();
  const finish = Promise.withResolvers<void>();
  let signal: AbortSignal | undefined;
  const action = registerWebviewResourceAction(
    f.host,
    { resource, label: "Versions", choices: [{ id: "first", label: "First" }] },
    async (accepted) => {
      signal = accepted;
      await finish.promise;
      accepted.throwIfAborted();
    },
  );
  await action.ready;
  f.emit({ type: "execute", registrationId: f.calls[0]!.registrationId, requestId: "accepted", choiceId: "first" });
  await Promise.resolve();
  await action.updateChoices([{ id: "first", label: "First", selected: true }], { label: "Revisions" });
  expect(signal?.aborted).toBe(false);
  expect(f.calls.at(-1)).toMatchObject({
    operation: "update-choices",
    label: "Revisions",
    choices: [{ id: "first", label: "First", selected: true }],
  });
  finish.resolve();
  await Bun.sleep(0);
  expect(f.calls.at(-1)).toMatchObject({ operation: "complete", requestId: "accepted", error: undefined });
  await action.dispose();
});
