import { expect, test } from "bun:test";
import { watch } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const server =
  'const server=Bun.serve({hostname:"127.0.0.1",port:0,fetch:()=>new Response("relay-ready")});console.log(server.url.href);process.once("SIGTERM",()=>{server.stop(true);process.exit(0)})';
const exercise = async (
  enabled: boolean,
  collector: string,
  check: (context: { url: string; directory: string; stop: () => Promise<number> }) => Promise<void>,
) => {
  const directory = await mkdtemp(join(tmpdir(), "pstdio-collector-process-"));
  const marker = join(directory, "collector-started");
  const binary = join(directory, "alloy");
  await writeFile(
    binary,
    "#!" +
      process.execPath +
      "\nconst marker=" +
      JSON.stringify(marker) +
      ";const stopped=" +
      JSON.stringify(join(directory, "collector-stopped")) +
      ";\n" +
      collector,
  );
  await chmod(binary, 0o755);
  let watcher: ReturnType<typeof watch> | undefined;
  const started = new Promise<void>((resolve) => {
    watcher = watch(directory, (_event, name) => {
      if (name === "collector-started") {
        watcher?.close();
        resolve();
      }
    });
  });
  const child = Bun.spawn(
    [process.execPath, join(import.meta.dir, "collector-process.ts"), process.execPath, "-e", server],
    {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        METRICS_WRITE_URL: enabled ? "https://monitoring.invalid/write/metrics" : undefined,
        METRICS_WRITE_TOKEN: enabled ? "diagnostic-only" : undefined,
        LOGS_WRITE_URL: enabled ? "https://monitoring.invalid/write/logs" : undefined,
        LOGS_WRITE_TOKEN: enabled ? "diagnostic-only" : undefined,
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const stop = async () => {
    child.kill("SIGTERM");
    return await child.exited;
  };
  try {
    const reader = child.stdout.getReader();
    const first = await reader.read();
    const url = new TextDecoder().decode(first.value).trim();
    reader.releaseLock();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    if (enabled) await started;
    await check({ url, directory, stop });
  } finally {
    watcher?.close();
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
};

test("relay remains available when its optional collector exits", async () => {
  await exercise(true, 'await Bun.write(marker,"started");process.exit(1);', async ({ url, stop }) => {
    expect(await (await fetch(url)).text()).toBe("relay-ready");
    expect(await stop()).toBe(0);
  });
});

test("relay shutdown also stops and reaps its running collector", async () => {
  await exercise(
    true,
    'process.once("SIGTERM",async()=>{await Bun.write(stopped,"stopped");process.exit(0)});setInterval(()=>{},1000);await Bun.write(marker,"started");',
    async ({ url, directory, stop }) => {
      expect(await (await fetch(url)).text()).toBe("relay-ready");
      expect(await stop()).toBe(0);
      expect(await Bun.file(join(directory, "collector-stopped")).text()).toBe("stopped");
    },
  );
});

test("relay starts without launching collection when monitoring is unconfigured", async () => {
  await exercise(false, 'await Bun.write(marker,"started");process.exit(1);', async ({ url, directory, stop }) => {
    expect(await (await fetch(url)).text()).toBe("relay-ready");
    expect(await Bun.file(join(directory, "collector-started")).exists()).toBe(false);
    expect(await stop()).toBe(0);
  });
});
