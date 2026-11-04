import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Installation is a build step. Runtime homes receive these package-local dependencies intact.
const temporary = await mkdtemp(join(tmpdir(), "pstdio-image-seed-"));
const env = { ...process.env, PSTDIO_HOME: join(temporary, "home"), PSTDIO_DEFAULT_EXTENSIONS: "[]" };
const run = async (...command: string[]) => {
  const child = Bun.spawn(["pstdio", ...command], {
    env,
    cwd: join(temporary, "project"),
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await child.exited) throw new Error("Device image default extension preparation failed");
};
try {
  await mkdir(join(temporary, "project"));
  await run("projects", "create", "Device image", "--path", join(temporary, "project"));
  // The normal source installer waits for each package-local dependency installation and validation.
  const catalog = await Bun.file("/opt/device-catalog.json").json();
  for (const entry of catalog.extensions.filter((entry: { default?: boolean }) => entry.default))
    await run("extensions", "add", entry.installName);
  await run("close");
  await mkdir("/opt/pstdio-defaults", { recursive: true });
  await cp(join(env.PSTDIO_HOME, "extensions"), "/opt/pstdio-defaults/extensions", { recursive: true });
} finally {
  await run("close").catch(() => {});
  await rm(temporary, { recursive: true, force: true });
}
