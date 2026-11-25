import { afterAll, beforeAll, expect, test } from "bun:test";
import { getEventListeners } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionProcessEnvironment } from "../process-environment";
import { backendWorkerCommand } from "./pool";
import { HANDLER_MARKER } from "./protocol";
import { startBackendWorker } from "./supervisor";

let root: string;
let entryPath: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "backend-signal-lifetime-"));
  entryPath = join(root, "extension.ts");
  await writeFile(
    entryPath,
    `
let retainedSignal;
export default {
  start(_ctx, { signal }) {
    const done = Promise.withResolvers();
    const finish = () => done.resolve(signal.aborted ? signal.reason.message : "stopped");
    if (signal.aborted) finish();
    else signal.addEventListener("abort", finish, { once: true });
    return { done: done.promise, stop: finish };
  },
  retain(_ctx, { signal }) {
    retainedSignal = signal;
    return retainedSignal.aborted;
  },
  drop() { retainedSignal = undefined; },
  collect() { Bun.gc(true); },
};
`,
  );
});

afterAll(async () => {
  await rm(root, { force: true, recursive: true });
});

const runBackend = async () => {
  const worker = await startBackendWorker({
    command: backendWorkerCommand(),
    env: createExtensionProcessEnvironment(),
    entryPath,
  });
  const definition = worker.definition as Record<string, { [HANDLER_MARKER]: string }>;
  return {
    stop: worker.stop,
    call: (method: string, args: unknown[] = []) =>
      worker.invoke({
        handlerId: definition[method]![HANDLER_MARKER],
        context: {},
        surface: { kind: "object", members: {} },
        args,
      }),
  };
};

test("a worker harness receives input cancellation after start returns", async () => {
  const worker = await runBackend();
  const controller = new AbortController();
  try {
    const session = (await worker.call("start", [{ signal: controller.signal }])) as {
      done: Promise<string>;
      stop(): Promise<void>;
    };
    await worker.call("collect");
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);

    controller.abort(new Error("cancelled after start"));
    const status = await Promise.race([session.done, Bun.sleep(1_000).then(() => "no forwarded abort")]);
    await session.stop();
    expect(status).toBe("cancelled after start");
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  } finally {
    await worker.stop();
  }
});

test("a worker releasing its signal detaches the host listener without an abort", async () => {
  const worker = await runBackend();
  const { signal } = new AbortController();
  try {
    expect(await worker.call("retain", [{ signal }])).toBe(false);
    await worker.call("collect");
    expect(getEventListeners(signal, "abort")).toHaveLength(1);

    await worker.call("drop");
    for (let attempt = 0; getEventListeners(signal, "abort").length && attempt < 50; attempt++) {
      await worker.call("collect");
      await Bun.sleep(10);
    }
    expect(signal.aborted).toBe(false);
    expect(getEventListeners(signal, "abort")).toHaveLength(0);
  } finally {
    await worker.stop();
  }
});
