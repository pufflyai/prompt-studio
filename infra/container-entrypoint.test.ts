import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("container commands receive a verified database connection using the injected CA", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pstdio-container-"));
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "container-entrypoint.ts"),
        process.execPath,
        "-e",
        "const url = new URL(process.env.DATABASE_URL); console.log(JSON.stringify({mode:url.searchParams.get('sslmode'), ca:await Bun.file(url.searchParams.get('sslrootcert')).text()}))",
      ],
      {
        env: {
          ...process.env,
          TMPDIR: directory,
          DATABASE_URL: "postgres://user:secret@db/test?sslmode=require",
          DATABASE_CA_CERT: "owned-test-ca",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(await child.exited).toBe(0);
    expect(await new Response(child.stdout).json()).toEqual({ mode: "verify-full", ca: "owned-test-ca" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
