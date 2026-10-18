import { strict as assert } from "node:assert";
import { resolve } from "node:path";

const project = `pstdio-relay-test-${crypto.randomUUID()}`;
const compose = ["docker", "compose", "-p", project, "-f", resolve(import.meta.dir, "../compose.test.yaml")];
console.log(`Isolated relay stack: ${project}`);

async function run(args: string[], capture = false) {
  const child = Bun.spawn(args, { stdout: capture ? "pipe" : "inherit", stderr: "inherit" });
  const output = capture ? new Response(child.stdout).text() : Promise.resolve("");
  const status = await child.exited;
  const text = await output;
  if (status !== 0) throw new Error(`${args.join(" ")} exited with ${status}`);
  return text.trim();
}

let interrupted = false;
let active: ReturnType<typeof Bun.spawn> | undefined;
function interrupt() {
  interrupted = true;
  active?.kill("SIGTERM");
}
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);

async function step(args: string[]) {
  if (interrupted) throw new Error("Relay smoke interrupted");
  active = Bun.spawn([...compose, ...args], { stdout: "inherit", stderr: "inherit" });
  const status = await active.exited;
  active = undefined;
  if (status !== 0 || interrupted) throw new Error(`Relay smoke step failed: ${args.join(" ")} (${status})`);
}

try {
  await step(["build", "relay", "smoke", "initialize", "authority", "tls"]);
  await step(["run", "--rm", "--no-deps", "tls"]);
  await step(["run", "--rm", "--no-deps", "tls", "bun", "test", "tls-validity.test.ts"]);
  await step(["up", "--wait", "postgres", "objects"]);
  await step(["run", "--rm", "--no-deps", "bucket"]);
  await step(["run", "--rm", "--no-deps", "initialize"]);
  await step(["up", "--wait", "authority", "relay"]);
  await step(["run", "--rm", "--no-deps", "smoke"]);
  await step(["stop", "relay"]);
  const relayId = await run([...compose, "ps", "--all", "--quiet", "relay"], true);
  const exitCode = await run(["docker", "inspect", "--format", "{{.State.ExitCode}}", relayId], true);
  assert.equal(exitCode, "0", "Relay must exit cleanly on Docker stop");
  console.log("Built relay clean shutdown passed");
} catch (error) {
  await run([...compose, "logs", "--no-color"]);
  throw error;
} finally {
  // The profile includes the test-only services, so their volumes are removed too.
  await run([...compose, "--profile", "test", "down", "--volumes", "--remove-orphans"]);
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
  console.log(`Removed isolated relay stack: ${project}`);
}
