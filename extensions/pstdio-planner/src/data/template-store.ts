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

interface TemplatePreference {
  enabled: boolean;
  displayName?: string | null;
  metadata?: unknown;
}

const templates = (ctx: CommandContext) => ctx.storage.collection<StoredTemplate>("templates");
const preferences = (ctx: CommandContext) => ctx.storage.collection<TemplatePreference>("template-preferences");
const normalizedName = (id: string) => id.replaceAll("_", "-");
const assetByName = (name: string) => plannerTemplateAssets.find((asset) => normalizedName(asset.id) === name);

export const listOwnedTemplates = async (ctx: CommandContext, type?: string) => {
  const [storedTemplates, defaultNames] = await Promise.all([
    templates(ctx).list(),
    ctx.storage.get<Record<string, string>>("template-defaults"),
  ]);
  const overrides = new Map(storedTemplates.map((item) => [item.name, item]));
  const shippedTemplates = plannerTemplateAssets.map((asset) => ({
    name: normalizedName(asset.id),
    title: asset.title,
    type: asset.type,
  }));
  const merged = new Map(shippedTemplates.map((item) => [item.name, { ...item, ...overrides.get(item.name) }]));
  for (const item of overrides.values()) if (!merged.has(item.name)) merged.set(item.name, item);
  const preferred = await Promise.all(
    [...merged.values()].map(async (item) => ({ item, preference: await preferences(ctx).get(item.name) })),
  );
  return preferred
    .filter(({ item, preference }) => !item.deleted && preference?.enabled !== false && (!type || item.type === type))
    .map(({ item: { blobId: _blobId, deleted: _deleted, ...item }, preference }) => ({
      ...item,
      title: preference?.displayName ?? item.title,
    }))
    .sort((left, right) => {
      const defaultName = defaultNames?.[left.type];
      if (left.name === defaultName) return -1;
      if (right.name === defaultName) return 1;
      return left.name.localeCompare(right.name);
    });
};

export const readOwnedTemplate = async (ctx: CommandContext, name: string): Promise<ResolvedTemplate | null> => {
  const [stored, preference] = await Promise.all([templates(ctx).get(name), preferences(ctx).get(name)]);
  if (preference?.enabled === false) return null;
  if (stored?.deleted) return null;
  if (stored?.blobId) {
    const content = new TextDecoder().decode(await templates(ctx).attachments(name).getBytes(stored.blobId));
    return { name: stored.name, title: preference?.displayName ?? stored.title, type: stored.type, content };
  }
  const asset = assetByName(name);
  if (!asset) return null;
  return {
    name,
    title: preference?.displayName ?? asset.title,
    type: asset.type,
    content: await ctx.packageFiles.readText(asset.path),
  };
};

export const saveOwnedTemplate = async (
  ctx: CommandContext,
  input: { name: string; title?: string; type: string; content: string },
) => {
  const current = await templates(ctx).get(input.name);
  const attachments = templates(ctx).attachments(input.name);
  const blob = await attachments.put({
    name: `${input.name}.md`,
    data: new TextEncoder().encode(input.content),
    mimeType: "text/markdown",
  });
  const asset = assetByName(input.name);
  try {
    await templates(ctx).put(input.name, {
      name: input.name,
      title: input.title ?? asset?.title ?? input.name,
      type: input.type,
      blobId: blob.id,
    });
  } catch (error) {
    await attachments.delete(blob.id).catch(() => undefined);
    throw error;
  }
  if (current?.blobId && current.blobId !== blob.id) {
    await attachments.delete(current.blobId).catch(() => undefined);
  }
  return readOwnedTemplate(ctx, input.name);
};

export const deleteOwnedTemplate = async (ctx: CommandContext, name: string) => {
  const current = await templates(ctx).get(name);
  const asset = assetByName(name);
  if (asset) {
    await templates(ctx).put(name, { name, title: asset.title, type: asset.type, deleted: true });
  } else {
    await templates(ctx).delete(name);
  }
  if (current?.blobId)
    await templates(ctx)
      .attachments(name)
      .delete(current.blobId)
      .catch(() => undefined);
};

export const renderOwnedTemplate = async (ctx: CommandContext, name: string, data: Record<string, unknown>) => {
  const template = await readOwnedTemplate(ctx, name);
  if (!template) throw new Error(`Template not found: ${name}`);
  return renderPrompt(template.content, data);
};
