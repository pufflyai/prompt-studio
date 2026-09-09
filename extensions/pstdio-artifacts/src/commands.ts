import { isAbsolute, relative } from "node:path";
import { defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";
import { type ArtifactRevision, createArtifactService, HTML_LIMIT_BYTES } from "./artifacts";
import { artifactIdFromUrl, artifactTarget, changedEvent } from "./contracts";
import { withProjectFiles } from "./project-files";

const serviceFor = (ctx: ExtensionContextBase) =>
  createArtifactService({
    projectId: ctx.projectId,
    artifacts: ctx.storage.collection<{ id: string }>("artifacts"),
    revisions: ctx.storage.collection<ArtifactRevision>("revisions"),
    names: ctx.storage.collection<{ title: string }>("names"),
    snapshots: ctx.artifacts.mount("sites"),
  });

const publishFile = async (
  ctx: ExtensionContextBase,
  input: { file_path: string; url?: string; favicon?: string; label?: string },
) => {
  const files = ctx.workspaceFiles ?? ctx.repoFiles;
  if (!files) throw new Error("Select a project workspace before publishing an HTML file.");
  let path = input.file_path;
  if (isAbsolute(path)) {
    const workspace = ctx.workspaceId ? await ctx.workspaces.get(ctx.workspaceId) : undefined;
    const root = workspace?.worktree_path ?? ctx.repo?.path;
    if (!root) throw new Error("Use a workspace-relative HTML file path.");
    path = relative(root, path);
  }
  if (path.split(/[\\/]/).includes("..") || isAbsolute(path))
    throw new Error("The HTML file must be inside the workspace.");
  const bytes = await files.readBytes(path);
  if (bytes.byteLength > HTML_LIMIT_BYTES) throw new Error("The HTML page exceeds the 16 MiB limit.");
  const result = await serviceFor(ctx).publish({
    ...input,
    file_path: path,
    html: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    workspaceId: ctx.workspaceId,
  });
  await ctx.events.emit(changedEvent, { artifactId: result.artifactId });
  return result;
};

const publish = defineCommand({
  id: "publish",
  title: l10n("commands.publish", "Publish artifact"),
  cli: true,
  params: {
    file_path: params.text({ label: l10n("params.filePath", "HTML file"), required: true }),
    url: params.text({ label: l10n("params.url", "Existing artifact URL") }),
    favicon: params.text({ label: l10n("params.favicon", "Emoji") }),
    label: params.text({ label: l10n("params.label", "Revision label") }),
  },
  run: (ctx, input) => withProjectFiles(ctx, "publish", input, () => publishFile(ctx, input)),
});

const list = defineCommand({
  id: "list",
  title: l10n("commands.list", "List artifacts"),
  cli: true,
  params: { search: params.text({ label: l10n("params.search", "Search") }) },
  run: (ctx, input) => serviceFor(ctx).list(input.search),
});

const read = defineCommand({
  id: "read",
  title: l10n("commands.read", "Read artifact"),
  cli: true,
  params: { url: params.text({ required: true }), revisionId: params.text() },
  run: (ctx, input) => serviceFor(ctx).read(input.url, input.revisionId),
});

const revisions = defineCommand({
  id: "revisions",
  title: l10n("commands.revisions", "List artifact revisions"),
  cli: true,
  params: { url: params.text({ required: true }) },
  run: (ctx, input) => serviceFor(ctx).revisions(input.url),
});

const open = defineCommand({
  id: "open",
  title: l10n("commands.open", "Open artifact"),
  cli: true,
  params: { url: params.text({ required: true }) },
  async run(ctx, input) {
    const current = (await serviceFor(ctx).revisions(input.url))[0];
    return artifactTarget(ctx.projectId, artifactIdFromUrl(ctx.projectId, input.url), current.title);
  },
});

const rename = defineCommand({
  id: "rename",
  title: l10n("commands.rename", "Rename artifact"),
  cli: true,
  params: { url: params.text({ required: true }), name: params.text({ required: true }) },
  async run(ctx, input) {
    const result = await serviceFor(ctx).rename(input.url, input.name);
    await ctx.events.emit(changedEvent, { artifactId: result.artifactId });
    return result;
  },
});

const remove = defineCommand({
  id: "delete",
  title: l10n("commands.delete", "Delete artifact"),
  cli: true,
  params: { url: params.text({ required: true }) },
  async run(ctx, input) {
    const result = await serviceFor(ctx).remove(input.url);
    await ctx.events.emit(changedEvent, result);
    return result;
  },
});

export const commands = { publish, list, read, revisions, open, rename, delete: remove };
