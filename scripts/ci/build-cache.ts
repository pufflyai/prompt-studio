import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { link, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

// Nx's supported HTTP cache protocol stores portable archives. Its local SQLite cache is machine-bound.
export const createBuildCache = (directory: string) => {
  mkdirSync(directory, { recursive: true });
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    maxRequestBodySize: 1024 * 1024 * 1024,
    async fetch(request) {
      const hash = new URL(request.url).pathname.match(/^\/v1\/cache\/([a-zA-Z0-9_-]+)$/)?.[1];
      if (!hash) return new Response(null, { status: 404 });
      const path = join(directory, `${hash}.tar.gz`);
      if (request.method === "GET") {
        const file = Bun.file(path);
        return (await file.exists()) ? new Response(file) : new Response(null, { status: 404 });
      }
      if (request.method !== "PUT") return new Response(null, { status: 405 });
      const temporary = join(directory, `${randomUUID()}.tmp`);
      try {
        await Bun.write(temporary, new Response(request.body));
        await link(temporary, path);
        return new Response(null, { status: 200 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") return new Response(null, { status: 409 });
        throw error;
      } finally {
        await unlink(temporary);
      }
    },
  });
};

if (import.meta.main) {
  const directory = resolve(".cache/ci-build");
  const ready = join(process.env.RUNNER_TEMP!, "ci-build-cache-ready");
  if (process.argv.includes("--serve")) {
    const server = createBuildCache(directory);
    writeFileSync(ready, `NX_SELF_HOSTED_REMOTE_CACHE_SERVER=${server.url.origin}\n`);
  } else {
    // A detached child keeps one loopback cache alive through subsequent job steps.
    // GitHub's runner cleans it up when the job finishes.
    const child = Bun.spawn([process.execPath, import.meta.path, "--serve"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: Bun.file(join(process.env.RUNNER_TEMP!, "ci-build-cache.log")),
    });
    child.unref();
    let started = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await Bun.file(ready).exists()) {
        appendFileSync(process.env.GITHUB_ENV!, readFileSync(ready, "utf8"));
        started = true;
        break;
      }
      await Bun.sleep(50);
    }
    if (!started) {
      child.kill();
      throw new Error("The job's build cache did not start; see ci-build-cache.log");
    }
  }
}
