import type { CommandContext } from "@pstdio/sdk/extensions";
import { renderPrompt } from "@pstdio/sdk/prompts";
import { plannerTemplateAssets } from "../../extension-assets";

export interface StoredTemplate {
  name: string;
  title: string;
  type: string;
  blobId?: string;
  deleted?: boolean;
}

export interface ResolvedTemplate extends Omit<StoredTemplate, "blobId" | "deleted"> {
  content: string;
}

const templates = (ctx: CommandContext) => ctx.storage.collection<StoredTemplate>("templates");
const normalizedName = (id: string) => id.replaceAll("_", "-");
const assetByName = (name: string) => plannerTemplateAssets.find((asset) => normalizedName(asset.id) === name);

export const listOwnedTemplates = async (ctx: CommandContext, type?: string) => {
  const overrides = new Map((await templates(ctx).list()).map((item) => [item.name, item]));
  const defaults = plannerTemplateAssets.map((asset) => ({
    name: normalizedName(asset.id),
    title: asset.title,
    type: asset.type,
  }));
  const merged = new Map(defaults.map((item) => [item.name, { ...item, ...overrides.get(item.name) }]));
  for (const item of overrides.values()) if (!merged.has(item.name)) merged.set(item.name, item);
  return [...merged.values()]
    .filter((item) => !item.deleted && (!type || item.type === type))
    .map(({ blobId: _blobId, deleted: _deleted, ...item }) => item)
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const readOwnedTemplate = async (ctx: CommandContext, name: string): Promise<ResolvedTemplate | null> => {
  const stored = await templates(ctx).get(name);
  if (stored?.deleted) return null;
  if (stored?.blobId) {
    const content = new TextDecoder().decode(await templates(ctx).attachments(name).getBytes(stored.blobId));
    return { name: stored.name, title: stored.title, type: stored.type, content };
  }
  const asset = assetByName(name);
  if (!asset) return null;
  return { name, title: asset.title, type: asset.type, content: await ctx.packageFiles.readText(asset.path) };
};

export const saveOwnedTemplate = async (
  ctx: CommandContext,
  input: { name: string; title?: string; type: string; content: string },
) => {
  const current = await templates(ctx).get(input.name);
  if (current?.blobId) await templates(ctx).attachments(input.name).delete(current.blobId);
  const blob = await templates(ctx)
    .attachments(input.name)
    .put({
      name: `${input.name}.md`,
      data: new TextEncoder().encode(input.content),
      mimeType: "text/markdown",
    });
  const asset = assetByName(input.name);
  await templates(ctx).put(input.name, {
    name: input.name,
    title: input.title ?? asset?.title ?? input.name,
    type: input.type,
    blobId: blob.id,
  });
  return readOwnedTemplate(ctx, input.name);
};

export const deleteOwnedTemplate = async (ctx: CommandContext, name: string) => {
  const current = await templates(ctx).get(name);
  if (current?.blobId) await templates(ctx).attachments(name).delete(current.blobId);
  const asset = assetByName(name);
  if (asset) {
    await templates(ctx).put(name, { name, title: asset.title, type: asset.type, deleted: true });
  } else {
    await templates(ctx).delete(name);
  }
};

export const renderOwnedTemplate = async (ctx: CommandContext, name: string, data: Record<string, unknown>) => {
  const template = await readOwnedTemplate(ctx, name);
  if (!template) throw new Error(`Template not found: ${name}`);
  return renderPrompt(template.content, data);
};
