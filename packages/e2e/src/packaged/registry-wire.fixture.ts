import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";

// The portable smoke checks the host's HTTP contract. The service-container job runs
// the same scenario against the production PSX image with PostgreSQL and S3.
export const startRegistryWireFixture = async () => {
  const versions: Array<{ id: string; version: string; enginesPstdio: string; sha256: string; withdrawn: boolean }> =
    [];
  const packages = new Map<string, Buffer>();
  const server = createServer((request, response) => {
    if (request.url === "/api/pstdio/pstdio-notes/versions") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ versions }));
      return;
    }
    const version = /^\/api\/pstdio\/pstdio-notes\/([^/]+)\/file$/.exec(request.url ?? "")?.[1];
    const bytes = version ? packages.get(version) : null;
    response.statusCode = bytes ? 200 : 404;
    response.end(bytes ?? "Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Registry fixture has no address");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: async () => {
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      server.closeAllConnections();
      await closed;
    },
    publish: async (path: string) => {
      const version = /^pstdio\.pstdio-notes-(\d+\.\d+\.\d+)\.tgz$/.exec(basename(path))?.[1];
      if (!version) throw new Error("Unexpected Notes fixture package name");
      const bytes = await readFile(path);
      // PSX indexes the engine range from the uploaded manifest, so the fixture reads it the same way.
      const manifest = (await new Bun.Archive(gunzipSync(bytes)).files()).get("package.json");
      const { engines } = JSON.parse((await manifest?.text()) ?? "{}") as { engines: { pstdio: string } };
      versions.push({
        id: "pstdio.pstdio-notes",
        version,
        enginesPstdio: engines.pstdio,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        withdrawn: false,
      });
      packages.set(version, bytes);
    },
  };
};
