import type { CommandContext } from "@pstdio/sdk/extensions";
import { reportTemplateAssets } from "../../report-templates";

interface StoredTemplate {
  name: string;
  title: string;
  type: string;
  blobId?: string;
  deleted?: boolean;
}

interface TemplatePreference {
  enabled: boolean;
  displayName?: string | null;
  metadata?: unknown;
}

const collection = (ctx: CommandContext) => ctx.storage.collection<StoredTemplate>("templates");
const preferences = (ctx: CommandContext) => ctx.storage.collection<TemplatePreference>("template-preferences");
const normalizeName = (name: string) => name.replaceAll("_", "-");
const assetByName = (name: string) => reportTemplateAssets.find((asset) => normalizeName(asset.id) === name);

export const listReportTemplates = async (ctx: CommandContext) => {
  const [storedTemplates, defaultNames] = await Promise.all([
    collection(ctx).list(),
    ctx.storage.get<Record<string, string>>("template-defaults"),
  ]);
  const overrides = new Map(storedTemplates.map((item) => [item.name, item]));
  const shippedTemplates = reportTemplateAssets.map((asset) => ({
    name: normalizeName(asset.id),
    title: asset.title,
    type: asset.type,
  }));
  const merged = new Map(shippedTemplates.map((item) => [item.name, { ...item, ...overrides.get(item.name) }]));
  for (const item of overrides.values()) if (!merged.has(item.name)) merged.set(item.name, item);
  const preferred = await Promise.all(
    [...merged.values()].map(async (item) => ({ item, preference: await preferences(ctx).get(item.name) })),
  );
  return preferred
    .filter(({ item, preference }) => !item.deleted && preference?.enabled !== false)
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

export const readReportTemplate = async (ctx: CommandContext, name: string) => {
  const [stored, preference] = await Promise.all([collection(ctx).get(name), preferences(ctx).get(name)]);
  if (preference?.enabled === false) return null;
  if (stored?.deleted) return null;
  if (stored?.blobId) {
    const content = new TextDecoder().decode(await collection(ctx).attachments(name).getBytes(stored.blobId));
    return { name, title: preference?.displayName ?? stored.title, type: stored.type, content };
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

export const saveReportTemplate = async (
  ctx: CommandContext,
  input: { name: string; title?: string; content: string },
) => {
  const current = await collection(ctx).get(input.name);
  const attachments = collection(ctx).attachments(input.name);
  const blob = await attachments.put({
    name: `${input.name}.md`,
    data: new TextEncoder().encode(input.content),
    mimeType: "text/markdown",
  });
  const asset = assetByName(input.name);
  try {
    await collection(ctx).put(input.name, {
      name: input.name,
      title: input.title ?? asset?.title ?? input.name,
      type: "report",
      blobId: blob.id,
    });
  } catch (error) {
    await attachments.delete(blob.id).catch(() => undefined);
    throw error;
  }
  if (current?.blobId && current.blobId !== blob.id) {
    await attachments.delete(current.blobId).catch(() => undefined);
  }
  return readReportTemplate(ctx, input.name);
};

export const deleteReportTemplate = async (ctx: CommandContext, name: string) => {
  const current = await collection(ctx).get(name);
  const asset = assetByName(name);
  if (asset) {
    await collection(ctx).put(name, { name, title: asset.title, type: asset.type, deleted: true });
  } else {
    await collection(ctx).delete(name);
  }
  if (current?.blobId)
    await collection(ctx)
      .attachments(name)
      .delete(current.blobId)
      .catch(() => undefined);
};
