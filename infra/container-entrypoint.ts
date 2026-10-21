import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// pg reads sslrootcert when it opens a pool, including for migration commands.
let directory: string | undefined;
try {
  if (process.env.DATABASE_CA_CERT) {
    directory = await mkdtemp(join(tmpdir(), "pstdio-database-"));
    const path = join(directory, "ca.pem");
    await writeFile(path, process.env.DATABASE_CA_CERT, { mode: 0o600 });
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set("sslmode", "verify-full");
    url.searchParams.set("sslrootcert", path);
    process.env.DATABASE_URL = url.href;
  }
  const child = Bun.spawn(process.argv.slice(2), {
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const stop = () => child.kill("SIGTERM");
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  process.exitCode = await child.exited;
  process.off("SIGTERM", stop);
  process.off("SIGINT", stop);
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
