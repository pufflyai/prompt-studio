import { strict as assert } from "node:assert";

const image = process.argv[2];
if (!image || !/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Pass the immutable loaded device image ID");
const suffix = crypto.randomUUID();
const container = `pstdio-device-smoke-${suffix}`;
const volume = `${container}-home`;
const run = async (...args: string[]) => {
  const child = Bun.spawn(["docker", ...args], { stdout: "pipe", stderr: "inherit" });
  const text = await new Response(child.stdout).text();
  if (await child.exited) throw new Error(`Device image smoke failed: docker ${args[0]}`);
  return text.trim();
};
try {
  await run("volume", "create", volume);
  await run("run", "-d", "--network", "none", "--name", container, "-v", `${volume}:/home/bun`, image);
  const ready = async () => {
    const startedAt = await run("inspect", container, "--format", "{{.State.StartedAt}}");
    const child = Bun.spawn(["docker", "logs", "--follow", "--since", startedAt, container], {
      stdout: "pipe",
      stderr: "ignore",
    });
    try {
      const reader = child.stdout.getReader();
      let output = "";
      while (!output.includes('"type":"runtime_ready"')) {
        const part = await reader.read();
        if (part.done) throw new Error("Device runtime exited before becoming ready");
        output += new TextDecoder().decode(part.value);
      }
    } finally {
      child.kill();
      await child.exited;
    }
  };
  await ready();
  const environment = () => run("exec", container, "pstdio", "projects", "environment");
  const first = JSON.parse(await environment());
  assert.ok(first.environmentId);
  const modules = await run(
    "exec",
    container,
    "bun",
    "-e",
    'for(const name of ["harness-codex","harness-claude-code","harness-open-code"]){if(!await Bun.file("/home/bun/.pstdio/extensions/"+name+"/package.json").exists())throw new Error("Missing installed harness");}',
  );
  assert.equal(modules, "");
  await run("stop", container);
  await run("start", container);
  await ready();
  assert.deepEqual(JSON.parse(await environment()), first, "Stop/start must keep the device identity");
  console.log("DEVICE_IMAGE_SMOKE_PASSED");
} finally {
  await run("rm", "--force", container).catch(() => {});
  await run("volume", "rm", volume);
}
