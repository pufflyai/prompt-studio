import { join, resolve } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Pass the PocketCoder source folder to prepare the local Codex image.");
const repo = resolve(source);
const command = async (args: string[]) => {
  const child = Bun.spawn(args, { cwd: repo, stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error(`${args[0]} failed.`);
};
await command(["bun", "build", "packages/supervisor/src/index.ts", "--target", "bun", "--outdir", "deploy/image/dist"]);
await command(["docker", "build", "-t", "pocketcoder-workspace:dev", "deploy/image"]);
await command(["docker", "build", "-t", "pocketcoder-pstdio-codex:local", import.meta.dir]);
const inspect = Bun.spawn(["docker", "image", "inspect", "pocketcoder-pstdio-codex:local", "--format", "{{.Id}}"], {
  stdout: "pipe",
  stderr: "inherit",
});
const digest = (await new Response(inspect.stdout).text()).trim();
if (await inspect.exited) throw new Error("Cannot inspect the built image.");
const manifest = {
  apiVersion: "pocketcoder.dev/v1alpha1",
  kind: "Template",
  metadata: {
    name: "prompt-studio-codex",
    description:
      "Prompt Studio and Codex in a disposable local machine. Cloud enrollment is required before relay chat.",
  },
  spec: {
    version: `1.0.0-local.${digest.slice(7, 19)}`,
    image: `pocketcoder-pstdio-codex:local@${digest}`,
    harness: { command: ["bun", "/opt/pstdio-tools/start.ts"] },
    resources: { cpu: "2", memory: "2Gi" },
    // A read-only root lets this template share an instance with templates that use immutable input storage.
    // Prompt Studio installs extensions into /work, which is too large for an in-memory folder.
    security: { readOnlyRoot: true },
    persistence: { mounts: [{ name: "work", target: "/work", maxBytes: 4 * 1024 ** 3, maxFiles: 500_000 }] },
    services: {
      pstdio: {
        baseUrl: "http://127.0.0.1:19841",
        healthPath: "/connection",
        routes: [{ method: "GET", path: "/connection" }],
      },
    },
    // The first start installs Prompt Studio's extensions into /work, which takes about 95 s on a macOS bind mount.
    timeouts: { start: "5m", maxAge: "1h", idle: "20m", terminateGrace: "10s" },
  },
};
const path = join(repo, ".pstdio/extension-storage/pocketcoder.pocketcoder/templates/prompt-studio-codex.json");
await Bun.write(path, JSON.stringify(manifest, null, 2));
console.log(`Prepared ${manifest.metadata.name}@${manifest.spec.version}\n${path}`);
