import { Console } from "node:console";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";

// Each write completes only after the target stream wrote it, so `finished` means delivered.
const trackWrites = (target: NodeJS.WriteStream) =>
  new Writable({
    write: (chunk, encoding, callback) => {
      target.write(chunk, encoding, callback);
    },
  });

/**
 * Temporary workaround, see ADR 0127: Bun's global console drops output that does
 * not fit into a full pipe. This console writes through the stream API, which waits
 * for the reader, and `exit` waits until that output is delivered.
 */
export const bindCliOutput = () => {
  const stdout = trackWrites(process.stdout);
  const stderr = trackWrites(process.stderr);
  // The node:console instance implements every method; only its declared type is narrower.
  globalThis.console = new Console({ stdout, stderr }) as unknown as typeof console;

  const exit = async (code: number) => {
    stdout.end();
    stderr.end();
    // A reader that closed early cannot receive the rest; exit anyway.
    await Promise.allSettled([finished(stdout), finished(stderr)]);
    process.exit(code);
  };

  return { exit };
};
