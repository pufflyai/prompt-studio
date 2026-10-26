import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ArtifactRevision, createArtifactService, HTML_LIMIT_BYTES } from "./artifacts";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const fixture = async (projectId = "project-1") => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-artifacts-"));
  directories.push(root);
  const records = new Map<string, ArtifactRevision>();
  const artifacts = new Map<string, { id: string }>();
  const names = new Map<string, { title: string }>();
  const input: Parameters<typeof createArtifactService>[0] = {
    projectId,
    artifacts: {
      get: async (id) => artifacts.get(id),
      createIfAbsent: async (id, value) => {
        if (artifacts.has(id)) return false;
        artifacts.set(id, value);
        return true;
      },
      delete: async (id) => {
        artifacts.delete(id);
      },
    },
    names: {
      get: async (id) => names.get(id),
      put: async (id, value) => {
        names.set(id, value);
      },
      delete: async (id) => {
        names.delete(id);
      },
    },
    revisions: {
      list: async () => [...records.values()],
      get: async (id) => records.get(id),
      delete: async (id) => {
        records.delete(id);
      },
      createIfAbsent: async (id, value) => {
        if (records.has(id)) return false;
        records.set(id, structuredClone(value));
        return true;
      },
    },
    snapshots: {
      writeText: (path, content) => writeFile(join(root, path), content),
      readText: (path) => readFile(join(root, path), "utf8"),
      delete: (path) => rm(join(root, path), { force: true }),
    },
  };
  const service = createArtifactService(input);
  return { service, records, names, root, input };
};

describe("published artifacts", () => {
  test("publishes a titled page and reads its saved HTML through its URL", async () => {
    const { service } = await fixture();
    const html = "<!doctype html><title>Release &amp; review</title><button>Ready</button>";
    const published = await service.publish({ file_path: "release.html", html, favicon: "📦", label: "Draft" });
    expect(published.title).toBe("Release & review");
    expect(published.url).toStartWith("/projects/project-1/extensions/pstdio.pstdio-artifacts/");
    expect((await service.read(published.url)).html).toBe(html);
    expect((await service.list())[0]).toMatchObject({ favicon: "📦", label: "Draft" });
  });

  test("keeps old snapshots and the same URL when publishing updates", async () => {
    const { service } = await fixture();
    const first = await service.publish({ file_path: "page.html", html: "<title>First</title>", favicon: "📦" });
    const second = await service.publish({
      file_path: "page.html",
      html: "<title>Second</title>",
      url: first.url,
      label: "Ready",
    });
    expect(second.url).toBe(first.url);
    expect(second.revisionId).not.toBe(first.revisionId);
    expect((await service.read(first.url, first.revisionId)).html).toBe("<title>First</title>");
    expect((await service.read(first.url)).favicon).toBe("📦");
    expect(await service.list()).toHaveLength(1);
    expect(await service.revisions(first.url)).toHaveLength(2);
  });

  test("uses the filename when the page has no title", async () => {
    const { service } = await fixture();
    expect((await service.publish({ file_path: "reports/weekly.htm", html: "<h1>Weekly</h1>" })).title).toBe("weekly");
  });

  test("rejects oversized or unsupported files before publishing a revision", async () => {
    const { service } = await fixture();
    await expect(service.publish({ file_path: "page.tsx", html: "hello" })).rejects.toThrow("HTML");
    await expect(service.publish({ file_path: "page.html", html: "x".repeat(HTML_LIMIT_BYTES + 1) })).rejects.toThrow(
      "16 MiB",
    );
    expect(await service.list()).toEqual([]);
  });

  test("rejects unknown and cross-project update URLs", async () => {
    const { service } = await fixture();
    const other = await fixture("project-2");
    const published = await other.service.publish({ file_path: "page.html", html: "<p>Hello</p>" });
    await expect(service.publish({ file_path: "page.html", html: "changed", url: published.url })).rejects.toThrow(
      "artifact URL",
    );
    await expect(service.read("https://example.com/page")).rejects.toThrow("artifact URL");
    expect(await service.list()).toEqual([]);
  });

  test("retains concurrent updates as complete immutable revisions", async () => {
    const { service } = await fixture();
    const first = await service.publish({ file_path: "page.html", html: "original" });
    const updates = await Promise.all(
      ["one", "two"].map((html) => service.publish({ file_path: "page.html", html, url: first.url })),
    );
    expect(await service.revisions(first.url)).toHaveLength(3);
    expect(
      await Promise.all(updates.map(async (update) => (await service.read(first.url, update.revisionId)).html)),
    ).toEqual(["one", "two"]);
  });

  test("keeps the previous publication after a snapshot write fails", async () => {
    const { service, root } = await fixture();
    const first = await service.publish({ file_path: "page.html", html: "original" });
    await rm(root, { recursive: true });
    await expect(service.publish({ file_path: "page.html", html: "changed", url: first.url })).rejects.toThrow();
    expect(await service.revisions(first.url)).toHaveLength(1);
  });
});

test("renames an artifact across versions and later publishes without changing saved HTML", async () => {
  const { service } = await fixture();
  const first = await service.publish({ file_path: "page.html", html: "<title>Original</title>" });
  const renamed = await service.rename(first.url, "  Research notes  ");
  expect(renamed.title).toBe("Research notes");
  expect(renamed.url).toBe(first.url);
  expect((await service.read(first.url)).html).toBe("<title>Original</title>");
  const second = await service.publish({ file_path: "page.html", html: "<title>Second</title>", url: first.url });
  expect(second.title).toBe("Research notes");
  expect((await service.revisions(first.url)).map((item) => item.title)).toEqual(["Research notes", "Research notes"]);
  expect(await service.list("research")).toHaveLength(1);
  await expect(service.rename(first.url, "  ")).rejects.toThrow("name");
});

test("deletes every revision and snapshot while preserving other artifacts", async () => {
  const { service, names, root } = await fixture();
  const first = await service.publish({ file_path: "page.html", html: "original" });
  const second = await service.publish({ file_path: "page.html", html: "updated", url: first.url });
  const other = await service.publish({ file_path: "other.html", html: "keep" });
  await service.rename(first.url, "Renamed");
  await service.remove(first.url);
  expect((await service.list()).map((item) => item.artifactId)).toEqual([other.artifactId]);
  expect(names.has(first.artifactId)).toBe(false);
  await expect(service.read(first.url)).rejects.toThrow("not found");
  await expect(readFile(join(root, `${first.id}.html`))).rejects.toThrow();
  await expect(readFile(join(root, `${second.id}.html`))).rejects.toThrow();
  expect((await service.read(other.url)).html).toBe("keep");
});

for (const phase of ["snapshot", "record"] as const) {
  test(`deletion wins while a publication is writing its ${phase}`, async () => {
    const { service, input, records, root } = await fixture();
    const first = await service.publish({ file_path: "page.html", html: "original" });
    const otherCommand = createArtifactService(input);
    const entered = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const pause = async () => {
      entered.resolve();
      await resume.promise;
    };
    if (phase === "snapshot") {
      const write = input.snapshots.writeText;
      input.snapshots.writeText = async (path, html) => {
        await pause();
        await write(path, html);
      };
    } else {
      const create = input.revisions.createIfAbsent;
      input.revisions.createIfAbsent = async (id, value) => {
        await pause();
        return create(id, value);
      };
    }
    const publication = otherCommand
      .publish({ file_path: "page.html", html: "late update", url: first.url })
      .catch((error: Error) => error);
    await entered.promise;
    try {
      await service.remove(first.url);
      await expect(service.read(first.url)).rejects.toThrow("not found");
    } finally {
      resume.resolve();
    }
    expect(await publication).toBeInstanceOf(Error);
    expect(((await publication) as Error).message).toContain("not found");
    expect(await service.list()).toEqual([]);
    expect(records.size).toBe(0);
    expect(await readdir(root)).toEqual([]);
  });
}
