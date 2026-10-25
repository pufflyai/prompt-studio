import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PsxDatabase } from "./database";
import type { createPackageObjects } from "./objects";
import { publishPackage } from "./publishing";
import { getRelease, objectKey } from "./releases";
import { extensionReleases } from "./schema";

export interface PsxOptions {
  database: PsxDatabase;
  objects: Awaited<ReturnType<typeof createPackageObjects>>;
  publishToken: string;
}
const authorised = (request: Request, token: string) => {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const listVersions = async (database: PsxDatabase, id: string) => {
  const rows = await database.select().from(extensionReleases).where(eq(extensionReleases.extensionId, id));
  return Response.json({
    versions: rows.map((row) => ({
      id,
      version: row.version,
      enginesPstdio: row.enginesPstdio,
      sha256: row.sha256,
      withdrawn: row.withdrawn,
      publishedAt: row.publishedAt.toISOString(),
    })),
  });
};
const releaseRequest = async (options: PsxOptions, request: Request, match: RegExpExecArray) => {
  const [, publisher, name, version, action] = match;
  const id = `${publisher}.${name}`;
  if (request.method === "GET" && version === "versions" && !action) return listVersions(options.database, id);
  const release = await getRelease(options.database, id, version);
  if (!release) return Response.json({ error: "Release not found" }, { status: 404 });
  if (request.method === "GET" && action === "file") {
    return new Response(new Uint8Array(await options.objects.get(objectKey(release))), {
      headers: {
        "content-type": "application/gzip",
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": `attachment; filename="${id}-${version}.tgz"`,
        etag: `"${release.sha256}"`,
      },
    });
  }
  if (request.method === "POST" && action === "withdraw") {
    await options.database
      .update(extensionReleases)
      .set({ withdrawn: true })
      .where(and(eq(extensionReleases.extensionId, id), eq(extensionReleases.version, version)));
    return Response.json({ id, version, withdrawn: true });
  }
  return Response.json({ error: "Not found" }, { status: 404 });
};
export const createPsx = (options: PsxOptions) => {
  if (!options.publishToken) throw new Error("PSX requires a publishing credential");
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/health" && request.method === "GET") {
        await options.database.select({ id: extensionReleases.extensionId }).from(extensionReleases).limit(1);
        return Response.json({ status: "ok" });
      }
      if (request.method === "POST" && !authorised(request, options.publishToken)) {
        return Response.json({ error: "Publishing permission required" }, { status: 401 });
      }
      if (request.method === "POST" && path === "/api/-/publish") return await publishPackage(options, request);
      const match =
        /^\/api\/([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)\/(versions|\d+\.\d+\.\d+)(?:\/(file|withdraw))?$/.exec(path);
      if (!match) return Response.json({ error: "Not found" }, { status: 404 });
      return await releaseRequest(options, request, match);
    } catch (error) {
      console.error("PSX request failed", error instanceof Error ? error.name : "unknown");
      return Response.json({ error: "Registry temporarily unavailable" }, { status: 503 });
    }
  };
};
