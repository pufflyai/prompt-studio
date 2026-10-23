// Test-only entry point for dev:isolated. The measured server is the compiled binary.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import type { RuntimeDescriptor } from "../packaged/packaged-serve-helpers";

const home = process.env.PSTDIO_HOME!;
const binary = process.env.PSTDIO_SCALE_LINUX_BINARY!;
const port = process.env.CONTAINER_API_PORT!;
const environmentPath = join(home, "scale-environment.json");
const environment = existsSync(environmentPath) ? JSON.parse(readFileSync(environmentPath, "utf8")) : {};
const child = Bun.spawn(
  [binary, "serve", "--foreground", "--owner", "persistent", "--host", "0.0.0.0", "--port", port],
  {
    env: {
      ...process.env,
      ...environment,
      PSTDIO_DISABLE_EMBED_MANIFEST: "0",
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_DB_PATH: join(home, "db.sqlite"),
      PSTDIO_STORAGE_PATH: join(home, "storage"),
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
process.on("SIGTERM", () => child.kill());
process.on("SIGINT", () => child.kill());
while (child.exitCode === null) {
  try {
    const descriptor = JSON.parse(readFileSync(join(home, "runtime.json"), "utf8")) as RuntimeDescriptor;
    const origin = `http://127.0.0.1:${port}`;
    const headers = { authorization: `Bearer ${descriptor.token}`, "content-type": "application/json" };
    const ready = await fetch(`${origin}/runtime/ready`, { headers });
    if (ready.ok && ((await ready.json()) as { instanceId: string }).instanceId === descriptor.instanceId) {
      const projects = await fetch(`${origin}/v1/projects`, { headers });
      if (!((await projects.json()) as unknown[]).length) {
        const folder = join(home, "project");
        mkdirSync(folder, { recursive: true });
        const created = await fetch(`${origin}/v1/projects`, {
          method: "POST",
          headers,
          body: JSON.stringify(folderProjectInput({ name: "Scale" }, folder)),
        });
        if (!created.ok) throw new Error(`Creating diagnostic project: ${created.status}`);
      }
      break;
    }
  } catch {}
  await Bun.sleep(200);
}
process.exit(await child.exited);
