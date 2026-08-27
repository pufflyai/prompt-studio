import type { CommandContext } from "@pstdio/sdk/extensions";
import { reportTemplateAssets } from "../../report-templates";

interface StoredTemplate {
  name: string;
  title: string;
  type: string;
  blobId?: string;
  deleted?: boolean;
}

const collection = (ctx: CommandContext) => ctx.storage.collection<StoredTemplate>("templates");
const normalizeName = (name: string) => name.replaceAll("_", "-");
const assetByName = (name: string) => reportTemplateAssets.find((asset) => normalizeName(asset.id) === name);

export const listReportTemplates = async (ctx: CommandContext) => {
  const overrides = new Map((await collection(ctx).list()).map((item) => [item.name, item]));
  const defaults = reportTemplateAssets.map((asset) => ({
    name: normalizeName(asset.id),
    title: asset.title,
    type: asset.type,
  }));
  const merged = new Map(defaults.map((item) => [item.name, { ...item, ...overrides.get(item.name) }]));
  for (const item of overrides.values()) if (!merged.has(item.name)) merged.set(item.name, item);
  return [...merged.values()]
    .filter((item) => !item.deleted)
    .map(({ blobId: _blobId, deleted: _deleted, ...item }) => item)
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const readReportTemplate = async (ctx: CommandContext, name: string) => {
  const stored = await collection(ctx).get(name);
  if (stored?.deleted) return null;
  if (stored?.blobId) {
    const content = new TextDecoder().decode(await collection(ctx).attachments(name).getBytes(stored.blobId));
    return { name, title: stored.title, type: stored.type, content };
  }
  const asset = assetByName(name);
  if (!asset) return null;
  return { name, title: asset.title, type: asset.type, content: await ctx.packageFiles.readText(asset.path) };
};

export const saveReportTemplate = async (
  ctx: CommandContext,
  input: { name: string; title?: string; content: string },
) => {
  const current = await collection(ctx).get(input.name);
  if (current?.blobId) await collection(ctx).attachments(input.name).delete(current.blobId);
  const blob = await collection(ctx)
    .attachments(input.name)
    .put({
      name: `${input.name}.md`,
      data: new TextEncoder().encode(input.content),
      mimeType: "text/markdown",
    });
  const asset = assetByName(input.name);
  await collection(ctx).put(input.name, {
    name: input.name,
    title: input.title ?? asset?.title ?? input.name,
    type: "report",
    blobId: blob.id,
  });
  return readReportTemplate(ctx, input.name);
};

export const deleteReportTemplate = async (ctx: CommandContext, name: string) => {
  const current = await collection(ctx).get(name);
  if (current?.blobId) await collection(ctx).attachments(name).delete(current.blobId);
  const asset = assetByName(name);
  if (asset) {
    await collection(ctx).put(name, { name, title: asset.title, type: asset.type, deleted: true });
  } else {
    await collection(ctx).delete(name);
  }
};
