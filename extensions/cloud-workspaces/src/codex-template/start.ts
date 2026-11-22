import { mkdir } from "node:fs/promises";

await mkdir("/work/project", { recursive: true });
await mkdir("/work/home", { recursive: true });
await mkdir("/work/tmp", { recursive: true });
process.env.TMPDIR = "/work/tmp";
process.env.PSTDIO_API_URL = "http://127.0.0.1:19840";
const command = async (args: string[]) => {
  const child = Bun.spawn(args, { cwd: "/work/project", stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(`${args[0]}: ${stderr}`);
  return stdout.trim();
};
await command(["git", "init"]);
const versions = { pstdio: await command(["pst", "--version"]), codex: await command(["codex", "--version"]) };
const runtime = Bun.spawn(
  ["pst", "serve", "--foreground", "--owner", "persistent", "--host", "127.0.0.1", "--port", "19840"],
  {
    cwd: "/work/project",
    stdout: "inherit",
    stderr: "inherit",
  },
);
const deadline = Date.now() + 60_000;
while (true) {
  const ready = await fetch("http://127.0.0.1:19840/healthz")
    .then((response) => response.ok)
    .catch(() => false);
  if (ready) break;
  if (Date.now() >= deadline) throw new Error("Prompt Studio did not start within 60 seconds.");
  await Bun.sleep(250);
}
await command(["pst", "projects", "create", "Codex relay test", "--path", "/work/project"]);
Bun.serve({
  hostname: "0.0.0.0",
  port: 19841,
  fetch(request) {
    if (new URL(request.url).pathname === "/connection")
      return Response.json({
        kind: "relay",
        state: "needs-enrollment",
        versions,
        message:
          "Prompt Studio is ready and Codex is installed. Cloud relay needs workspace-scoped, expiring device enrollment; this runtime has no account credentials.",
      });
    return new Response("Not found", { status: 404 });
  },
});
process.on("SIGTERM", () => runtime.kill("SIGTERM"));
const code = await runtime.exited;
process.exit(code);
