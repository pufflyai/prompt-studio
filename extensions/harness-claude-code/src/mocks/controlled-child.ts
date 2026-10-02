import { PassThrough, Writable } from "node:stream";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";

/** An event sink that keeps the conversation the way the host does, starting from `history`. */
export const recordingSink = (history: SessionMessage[] = []) => {
  const patches: JsonPatch[] = [];
  const messages = [...history];
  const sink = {
    getMessages: () => [...messages],
    push: (patch: JsonPatch) => {
      patches.push(patch);
      const index = Number(patch.path.split("/").at(-1));
      if (patch.op === "add") messages.splice(index, 0, patch.value as SessionMessage);
      if (patch.op === "replace") messages[index] = patch.value as SessionMessage;
    },
  };
  return { patches, messages, sink };
};

/** A fake Claude process whose stdout the test writes and whose stdin replies the test reads. */
export const controlledChild = () => {
  let ended = false;
  const writes: string[] = [];
  let resolveExit: (exit: { code: number | null; signal: string | null }) => void = () => {};
  const stdout = new PassThrough();
  const stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
    final(callback) {
      ended = true;
      callback();
    },
  });
  // Record every write the harness attempts, including one a real child's pipe would reject.
  const passThroughWrite = stdin.write.bind(stdin);
  stdin.write = ((chunk: unknown, ...rest: unknown[]) => {
    writes.push(String(chunk));
    return (passThroughWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof stdin.write;

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    resolveExit = resolve;
  });

  return {
    child: {
      stdin,
      stdout,
      stderr: new PassThrough(),
      kill: () => {},
      onExit,
      // A real exit closes the pipes, so a reply decided later can no longer reach the process.
      exit: () => {
        stdout.end();
        stdin.destroy();
        resolveExit({ code: 0, signal: null });
      },
    },
    stdinEnded: () => ended,
    written: () => writes.map((line) => JSON.parse(line)),
    emit: (event: object) => stdout.write(`${JSON.stringify(event)}\n`),
  };
};

export const waitForStreamIo = () => new Promise((resolve) => setTimeout(resolve, 10));
