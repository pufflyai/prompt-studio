import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A raw PTY delivers ETX as input instead of synthesizing SIGINT. Exercise the real
// stream so the Windows console fallback cannot pass by emitting a mocked signal.
test.each([false, true])("terminal Ctrl+C restores the previous raw mode (%s)", async (raw) => {
  const root = mkdtempSync(join(tmpdir(), "terminal-interrupt-"));
  const report = join(root, "report.jsonl");
  let output = "";
  const ready = Promise.withResolvers<void>();
  // The child can exit before the PTY delivers its last bytes; the stream closes after them.
  const closed = Promise.withResolvers<void>();
  const helper = new URL("./terminal-interrupt.ts", import.meta.url).href;
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import { appendFileSync } from "node:fs";
    import { onTerminalInterrupt } from ${JSON.stringify(helper)};
    process.stdin.setRawMode(${raw});
    process.stdin.pause();
    const deadline = setTimeout(() => { stop(); process.stdin.pause(); process.exitCode = 2; }, 2000);
    const stop = onTerminalInterrupt(() => {
      clearTimeout(deadline);
      stop();
      appendFileSync(${JSON.stringify(report)}, JSON.stringify({ interrupted: true, raw: process.stdin.isRaw, flowing: process.stdin.readableFlowing }) + "\\n");
      process.exitCode = 130;
    });
    console.log("ready");
  `,
    ],
    {
      terminal: {
        cols: 80,
        rows: 24,
        data(_terminal, bytes) {
          output += Buffer.from(bytes).toString();
          if (output.includes("ready")) ready.resolve();
        },
        exit: () => closed.resolve(),
      },
    },
  );
  try {
    await Promise.race([
      ready.promise,
      child.exited.then(() => {
        throw new Error(output);
      }),
    ]);
    child.terminal!.write("\u0003");
    const [code] = await Promise.all([child.exited, closed.promise]);
    expect({ code, output }).toMatchObject({ code: 130 });
    // Read state outside terminal rendering: ConPTY can prepend cursor-control bytes to console output.
    const reports = readFileSync(report, "utf8").trim().split(/\r?\n/);
    expect(reports).toHaveLength(1);
    expect(JSON.parse(reports[0]!)).toEqual({ interrupted: true, raw, flowing: false });
  } finally {
    child.kill();
    child.terminal?.close();
    await child.exited;
    rmSync(root, { recursive: true, force: true });
  }
});
