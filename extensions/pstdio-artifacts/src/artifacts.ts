import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import type { ArtifactMount, ExtensionStorageCollectionApi } from "@pstdio/sdk/extensions";
import { decodeHTML } from "entities";
import { artifactIdFromUrl, artifactResource, artifactTarget, artifactUrl } from "./contracts";

export const HTML_LIMIT_BYTES = 16 * 1024 * 1024;

export interface ArtifactRevision {
  id: string;
  artifactId: string;
  title: string;
  favicon?: string;
  label?: string;
  publishedAt: string;
  size: number;
  hash: string;
  source?: { workspaceId?: string; path: string };
}

interface ArtifactServiceInput {
  projectId: string;
  artifacts: Pick<ExtensionStorageCollectionApi<{ id: string }>, "get" | "createIfAbsent" | "delete">;
  revisions: Pick<ExtensionStorageCollectionApi<ArtifactRevision>, "get" | "list" | "createIfAbsent" | "delete">;
  names: Pick<ExtensionStorageCollectionApi<{ title: string }>, "get" | "put" | "delete">;
  snapshots: Pick<ArtifactMount, "readText" | "writeText" | "delete">;
}

interface PublishInput {
  file_path: string;
  html: string;
  url?: string;
  favicon?: string;
  label?: string;
  workspaceId?: string;
}

const titleFromHtml = async (html: string, path: string) => {
  let title = "";
  let finished = false;
  const rewriter = new HTMLRewriter().on("title", {
    element(element) {
      element.onEndTag(() => {
        finished = true;
      });
    },
    text(chunk) {
      if (!finished) title += chunk.text;
    },
  });
  await rewriter.transform(new Response(html)).text();
  return decodeHTML(title).trim() || basename(path, extname(path));
};

const newestFirst = (a: ArtifactRevision, b: ArtifactRevision) =>
  b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id);

export const createArtifactService = (input: ArtifactServiceInput) => {
  const { projectId, artifacts, snapshots, names, revisions: records } = input;
  const summary = async (revision: ArtifactRevision) => {
    const title = (await names.get(revision.artifactId))?.title ?? revision.title;
    return {
      ...revision,
      title,
      revisionId: revision.id,
      url: artifactUrl(projectId, revision.artifactId),
      resource: artifactResource(projectId, revision.artifactId, title),
      target: artifactTarget(projectId, revision.artifactId, title),
    };
  };

  const revisions = async (url: string) => {
    const id = artifactIdFromUrl(projectId, url);
    if (!(await artifacts.get(id))) throw new Error("Artifact not found.");
    const items = (await records.list()).filter((item) => item.artifactId === id).sort(newestFirst);
    if (!items.length) throw new Error("Artifact not found.");
    return Promise.all(items.map(summary));
  };

  const read = async (url: string, revisionId?: string) => {
    const items = await revisions(url);
    const revision = revisionId ? items.find((item) => item.id === revisionId) : items[0];
    if (!revision) throw new Error("Artifact revision not found.");
    return { ...revision, html: await snapshots.readText(`${revision.id}.html`) };
  };

  const list = async (search = "") => {
    const latest = new Map<string, ArtifactRevision>();
    for (const revision of (await records.list()).sort(newestFirst)) {
      if (!latest.has(revision.artifactId)) latest.set(revision.artifactId, revision);
    }
    const query = search.trim().toLocaleLowerCase();
    const existing = await Promise.all(
      [...latest.values()].map(async (revision) => ((await artifacts.get(revision.artifactId)) ? revision : undefined)),
    );
    const items = await Promise.all(existing.filter((revision) => revision !== undefined).map(summary));
    return items.filter((item) => item.title.toLocaleLowerCase().includes(query));
  };

  const publish = async (value: PublishInput) => {
    if (!/\.html?$/i.test(value.file_path)) throw new Error("Publish a self-contained HTML (.html or .htm) file.");
    const size = Buffer.byteLength(value.html, "utf8");
    if (size > HTML_LIMIT_BYTES) throw new Error("The HTML page exceeds the 16 MiB limit.");
    const previous = value.url ? (await revisions(value.url))[0] : undefined;
    const id = crypto.randomUUID();
    const revision: ArtifactRevision = {
      id,
      artifactId: previous?.artifactId ?? crypto.randomUUID(),
      title: await titleFromHtml(value.html, value.file_path),
      favicon: value.favicon ?? previous?.favicon,
      label: value.label,
      publishedAt: new Date(Math.max(Date.now(), previous ? Date.parse(previous.publishedAt) + 1 : 0)).toISOString(),
      size,
      hash: createHash("sha256").update(value.html).digest("hex"),
      source: { path: value.file_path, ...(value.workspaceId ? { workspaceId: value.workspaceId } : {}) },
    };
    const path = `${id}.html`;
    try {
      await snapshots.writeText(path, value.html);
      if (!(await records.createIfAbsent(id, revision))) throw new Error("Revision already exists.");
      if (!previous) await artifacts.createIfAbsent(revision.artifactId, { id: revision.artifactId });
      // Deletion removes identity first. A publication that finishes later cleans up its own revision.
      if (!(await artifacts.get(revision.artifactId))) throw new Error("Artifact not found.");
    } catch (error) {
      await records.delete(id).catch(() => {});
      await snapshots.delete(path).catch(() => {});
      throw error;
    }
    return summary(revision);
  };

  const rename = async (url: string, value: string) => {
    const title = value.trim();
    if (!title) throw new Error("Enter an artifact name.");
    const [current] = await revisions(url);
    await names.put(current.artifactId, { title });
    if (!(await artifacts.get(current.artifactId))) {
      await names.delete(current.artifactId);
      throw new Error("Artifact not found.");
    }
    return summary(current);
  };

  const remove = async (url: string) => {
    const id = artifactIdFromUrl(projectId, url);
    if (!(await artifacts.get(id))) throw new Error("Artifact not found.");
    await artifacts.delete(id);
    const items = (await records.list()).filter((item) => item.artifactId === id);
    for (const item of items) {
      await snapshots.delete(`${item.id}.html`);
      await records.delete(item.id);
    }
    await names.delete(id);
    return { artifactId: id };
  };

  return { publish, read, list, revisions, rename, remove };
};

export type ArtifactSummary = Awaited<ReturnType<ReturnType<typeof createArtifactService>["publish"]>>;
export type ArtifactContent = Awaited<ReturnType<ReturnType<typeof createArtifactService>["read"]>>;
