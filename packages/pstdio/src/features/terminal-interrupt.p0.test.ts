import { expect, test } from "bun:test";

// A raw PTY delivers ETX as input instead of synthesizing SIGINT. Exercise the real
// stream so the Windows console fallback cannot pass by emitting a mocked signal.
test.each([false, true])("terminal Ctrl+C restores the previous raw mode (%s)", async (raw) => {
  let output = "";
  const ready = Promise.withResolvers<void>();
  const helper = new URL("./terminal-interrupt.ts", import.meta.url).href;
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import { onTerminalInterrupt } from ${JSON.stringify(helper)};
    process.stdin.setRawMode(${raw});
    process.stdin.pause();
    const deadline = setTimeout(() => { stop(); process.stdin.pause(); process.exitCode = 2; }, 2000);
    const stop = onTerminalInterrupt(() => {
      clearTimeout(deadline);
      stop();
      console.log(JSON.stringify({ interrupted: true, raw: process.stdin.isRaw, flowing: process.stdin.readableFlowing }));
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
    expect({ code: await child.exited, output }).toMatchObject({ code: 130 });
    const reports = output.split(/\r?\n/).filter((line) => line.startsWith("{"));
    expect(reports).toHaveLength(1);
    expect(JSON.parse(reports[0]!)).toEqual({ interrupted: true, raw, flowing: false });
  } finally {
    child.kill();
    child.terminal?.close();
    await child.exited;
  }
});
